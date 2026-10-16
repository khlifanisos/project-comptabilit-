<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\AuditBalanceImport;
use App\Models\AuditBalanceLigne;
use App\Support\SpreadsheetRowReader;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Reproduces, as a web feature, the "ConsoliderBalances" VBA macro from
 * Modele_Consolidation_Balances_VALIDE.xlsx: the client uploads a balance N
 * and a balance N-1 (plus an optional grand livre), and we merge them by
 * Compte exactly like the macro's Scripting.Dictionary pass — same column
 * auto-detection, same duplicate-account summing, same "present in only one
 * balance" vs "present in both" classification.
 */
class AuditBalanceController extends Controller
{
    private const TYPES = ['n', 'n_1', 'grand_livre'];

    private const LABELS = [
        'n'           => 'Balance N',
        'n_1'         => 'Balance N-1',
        'grand_livre' => 'Grand livre',
    ];

    /** Header synonyms (lowercased, trimmed) the macro's TrouverColonne would also accept. */
    /** Header prefixes (normalized: lowercase, no accents, "_" → space); first matching column wins. */
    private const HEADER_SYNONYMS = [
        'compte'  => ['compte', 'n° compte', 'numero de compte', 'code compte'],
        'libelle' => ['libelle', 'intitule'],
        // Account name ("designat" in grand livre exports) — preferred over the entry's "libelle".
        'designation' => ['designat'],
        'date'    => ['date', "date d'operation", 'date operation', 'date piece'],
    ];

    /**
     * Amount columns are matched exactly, not by prefix: grand livre exports
     * carry "solde_d"/"solde_c" and "debiteur"/"crediteur" next to the real
     * "debit"/"credit", and a prefix match would pick the wrong one.
     */
    private const HEADER_PATTERNS = [
        'solde'   => '/^solde( (n|n-1|n 1|\d{4}|final|fin|net|cloture))?$/',
        'solde_d' => '/^solde (d|deb|debit|debiteur)$/',
        'solde_c' => '/^solde (c|cred|credit|crediteur)$/',
        // Opening balance: balance exports with "solde_ini / debit / credit" give the
        // year's movements only, so the closing balance is solde_ini + debit − credit.
        'solde_ini' => "/^(solde (ini|init|initial|ouverture|d'ouverture|anterieur|a nouveau)|report|a nouveau)$/",
        'debit'   => '/^(total |mouvements? |mvt )?debits?( \d{4})?$/',
        'credit'  => '/^(total |mouvements? |mvt )?credits?( \d{4})?$/',
    ];

    /**
     * Audit section by account prefix: [first 2 digits from, to, section].
     * Prefixes not listed (and 25–26, 73, 78) get no section.
     */
    private const SECTIONS_AUDIT = [
        [10, 15, 'R'], [16, 16, 'E'], [21, 24, 'G'], [28, 29, 'G'], [37, 39, 'K'],
        [40, 40, 'V'], [41, 41, 'L'], [42, 42, 'U'], [43, 43, 'T'], [44, 48, 'M'],
        [49, 49, 'L'], [50, 58, 'O'], [60, 63, 'V'], [64, 64, 'U'], [65, 65, 'O'],
        [66, 66, 'T'], [68, 68, 'G'], [69, 69, 'T'], [70, 70, 'L'], [75, 75, 'O'],
    ];

    /** 627… is the one 3-digit exception: inside 60–63 (V) but audited under O. */
    public static function sectionAudit(string $compte): string
    {
        $compte = trim($compte);
        if (str_starts_with($compte, '627')) {
            return 'O';
        }
        $prefix = (int) substr($compte, 0, 2);
        foreach (self::SECTIONS_AUDIT as [$from, $to, $section]) {
            if ($prefix >= $from && $prefix <= $to) {
                return $section;
            }
        }
        return '';
    }

    private function resolveClientId(Request $request): ?int
    {
        $user = $request->user();
        return $user instanceof Administrateur
            ? (int) $request->input('client_id')
            : $user->id;
    }

    private function assertType(string $type): void
    {
        abort_unless(in_array($type, self::TYPES, true), 422, 'Type de balance invalide.');
    }

    public function index(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => "Aucun client sélectionné."], 422);
        }

        $imports = AuditBalanceImport::where('client_id', $clientId)->get()->keyBy('type');

        $result = [];
        foreach (self::TYPES as $type) {
            $imp = $imports->get($type);
            $result[$type] = $imp ? [
                'id'          => $imp->id,
                'label'       => self::LABELS[$type],
                'nom_fichier' => $imp->nom_fichier,
                'nb_lignes'   => $imp->nb_lignes,
                'uploaded_at' => $imp->created_at,
            ] : null;
        }

        $consolidation = [];
        $ecarts = [];
        if ($imports->has('n') && $imports->has('n_1')) {
            ['consolidation' => $consolidation, 'ecarts' => $ecarts] = $this->consolidate(
                $imports['n_1']->lignes()->get(),
                $imports['n']->lignes()->get()
            );
        }

        return response()->json([
            'imports'       => $result,
            'consolidation' => $consolidation,
            'ecarts'        => $ecarts,
        ]);
    }

    public function upload(Request $request, string $type)
    {
        $this->assertType($type);

        $request->validate([
            // A full grand livre easily weighs 10–20 MB.
            'fichier' => 'required|file|mimes:xlsx,xls,csv,txt|max:51200',
        ]);

        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => "Aucun client sélectionné."], 422);
        }

        /** @var UploadedFile $file */
        $file = $request->file('fichier');
        $need = $type === 'grand_livre' ? 'Compte' : 'Compte et Solde';

        try {
            $rows = $this->balanceRows($file->getRealPath(), $type);
        } catch (\Throwable $e) {
            return response()->json(['message' => "Impossible de lire ce fichier : " . $e->getMessage()], 422);
        }
        if ($rows === null) {
            return response()->json([
                'message' => "Colonnes obligatoires introuvables. Vérifiez les en-têtes : {$need}.",
            ], 422);
        }

        $path = $file->store("audit_balances/{$clientId}/{$type}", 'public');
        $previous = AuditBalanceImport::where('client_id', $clientId)->where('type', $type)->value('fichier');

        // Rows are streamed from the file straight into the table in batches, so a
        // 300 000-line grand livre never sits in memory. Any failure (or an empty
        // file) rolls back and leaves the previous import untouched.
        try {
            [$import, $count] = DB::transaction(function () use ($rows, $clientId, $type, $file, $path) {
                $import = AuditBalanceImport::updateOrCreate(
                    ['client_id' => $clientId, 'type' => $type],
                    ['nom_fichier' => $file->getClientOriginalName(), 'fichier' => $path, 'nb_lignes' => 0]
                );
                // Replace previous rows (re-upload overwrites, matching the macro's wsC.Cells.Clear reset).
                $import->lignes()->delete();

                $now = now();
                $count = 0;
                $batch = [];
                foreach ($rows as $r) {
                    $batch[] = [
                        'import_id'      => $import->id,
                        'compte'         => mb_substr($r['compte'], 0, 255),
                        'libelle'        => $r['libelle'] !== null ? mb_substr($r['libelle'], 0, 255) : null,
                        'solde'          => $r['solde'],
                        'date_operation' => $r['date'],
                        'debit'          => $r['debit'],
                        'credit'         => $r['credit'],
                        'created_at'     => $now,
                        'updated_at'     => $now,
                    ];
                    if (count($batch) === 1000) {
                        DB::table('audit_balance_lignes')->insert($batch);
                        $count += count($batch);
                        $batch = [];
                    }
                }
                if ($batch) {
                    DB::table('audit_balance_lignes')->insert($batch);
                    $count += count($batch);
                }
                if ($count === 0) {
                    throw new \RuntimeException('EMPTY');
                }

                $import->update(['nb_lignes' => $count]);
                return [$import, $count];
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            return response()->json([
                'message' => $e->getMessage() === 'EMPTY'
                    ? "Aucune ligne exploitable dans ce fichier. Vérifiez les en-têtes : {$need}."
                    : "Impossible de lire ce fichier : " . $e->getMessage(),
            ], 422);
        }

        if ($previous && $previous !== $path) {
            Storage::disk('public')->delete($previous);
        }

        return response()->json([
            'message' => self::LABELS[$type] . ' importée (' . number_format($count, 0, ',', ' ') . ' lignes).',
            'import'  => [
                'id'          => $import->id,
                'label'       => self::LABELS[$type],
                'nom_fichier' => $import->nom_fichier,
                'nb_lignes'   => $import->nb_lignes,
                'uploaded_at' => $import->created_at,
            ],
        ], 201);
    }

    public function destroy(Request $request, string $type)
    {
        $this->assertType($type);
        $clientId = $this->resolveClientId($request);

        $import = AuditBalanceImport::where('client_id', $clientId)->where('type', $type)->first();
        if ($import) {
            Storage::disk('public')->delete($import->fichier);
            $import->delete(); // cascades to lignes
        }

        return response()->json(['message' => 'Import supprimé.']);
    }

    /**
     * Excel export matching the "Balance_Consolidee_2024_2025_Expert" reference workbook:
     * - "Balance consolidée": Compte / Libelle / Solde N-1 / Solde N sorted by compte,
     *   then Variation (=D-C), Variation % (=Variation / Solde N-1) and Section audit
     *   (letter derived from the account prefix, see SECTIONS_AUDIT). No total row.
     * - "Uniquement {N-1}" / "Uniquement {N}": accounts found in only one balance.
     * - "Section X": one sheet per audit section; the letters in column G link to them.
     * Column headers and sheet names carry the fiscal years (?annee=N, default last year).
     * ?section=T exports only that section's sheet.
     */
    public function exportConsolidation(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        $imports = AuditBalanceImport::where('client_id', $clientId)->whereIn('type', ['n', 'n_1'])->get()->keyBy('type');

        if (!$imports->has('n') || !$imports->has('n_1')) {
            return response()->json(['message' => 'Importez la balance N et la balance N-1 avant de générer la consolidation.'], 422);
        }

        $anneeN  = (int) ($request->input('annee') ?: now()->year - 1);
        $anneeN1 = $anneeN - 1;

        ['consolidation' => $consolidation, 'ecarts' => $ecarts] = $this->consolidate(
            $imports['n_1']->lignes()->get(),
            $imports['n']->lignes()->get()
        );

        $uniquementN1 = array_values(array_filter($ecarts, fn ($r) => $r['statut'] === 'Présent uniquement en N-1'));
        $uniquementN  = array_values(array_filter($ecarts, fn ($r) => $r['statut'] === 'Présent uniquement en N'));

        $headers = ['Compte', 'Libelle', "Solde {$anneeN1}", "Solde {$anneeN}"];
        $sectionHeaders = [...$headers, 'Variation', 'Variation %'];

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        $section = strtoupper(trim((string) $request->input('section', '')));
        if ($section !== '') {
            $rows = array_values(array_filter($consolidation, fn ($r) => $r['section'] === $section));
            $this->writeConsolidatedSheet($spreadsheet->getActiveSheet()->setTitle("Section {$section}"), $sectionHeaders, $rows);
            $filename = "Section_{$section}_{$anneeN1}_{$anneeN}.xlsx";
        } else {
            $this->writeConsolidatedSheet($spreadsheet->getActiveSheet()->setTitle('Balance consolidée'),
                [...$headers, 'Variation', 'Variation %', 'Section audit'], $consolidation);
            $this->writeUniquementSheet($spreadsheet->createSheet()->setTitle("Uniquement {$anneeN1}"), $headers, $uniquementN1);
            $this->writeUniquementSheet($spreadsheet->createSheet()->setTitle("Uniquement {$anneeN}"), $headers, $uniquementN);

            foreach (self::sectionsOrdonnees() as $lettre) {
                $rows = array_values(array_filter($consolidation, fn ($r) => $r['section'] === $lettre));
                if (!$rows) continue;
                $sheet = $spreadsheet->createSheet()->setTitle("Section {$lettre}");
                $this->writeConsolidatedSheet($sheet, $sectionHeaders, $rows);
                // Way back to the main sheet, next to the table.
                $sheet->setCellValue('H1', '← Balance consolidée');
                $sheet->getCell('H1')->getHyperlink()->setUrl("sheet://'Balance consolidée'!A1");
                $sheet->getStyle('H1')->getFont()->setUnderline(true)->getColor()->setRGB('0563C1');
                $sheet->getColumnDimension('H')->setWidth(24);
            }
            $this->linkSections($spreadsheet->getSheet(0), $spreadsheet);
            $filename = "Balance_Consolidee_{$anneeN1}_{$anneeN}.xlsx";
        }
        $spreadsheet->setActiveSheetIndex(0);

        $tmp = tempnam(sys_get_temp_dir(), 'conso');
        (new Xlsx($spreadsheet))->save($tmp);

        return response()->download($tmp, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** Dark-blue, bold white, centered, thin-bordered header row shared by all three sheets. */
    private function writeHeader($sheet, array $headers): void
    {
        $sheet->fromArray($headers, null, 'A1');
        $lastCol = chr(ord('A') + count($headers) - 1);
        $style = $sheet->getStyle("A1:{$lastCol}1");
        $style->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1F4E78');
        $style->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_TOP);
        $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
    }

    private function writeRow($sheet, int $r, array $row): void
    {
        // Compte kept as text so long account numbers are not turned into 1.01E+9.
        $sheet->setCellValueExplicit("A{$r}", $row['compte'], DataType::TYPE_STRING);
        $sheet->setCellValue("B{$r}", $row['libelle']);
        $sheet->setCellValue("C{$r}", $row['solde_n_1']);
        $sheet->setCellValue("D{$r}", $row['solde_n']);
    }

    private function writeConsolidatedSheet($sheet, array $headers, array $rows): void
    {
        $this->writeHeader($sheet, $headers);
        $withSection = count($headers) > 6;

        $r = 2;
        foreach ($rows as $row) {
            $this->writeRow($sheet, $r, $row);
            $sheet->setCellValue("E{$r}", "=+D{$r}-C{$r}");
            // Always shown as a positive rate; blank instead of #DIV/0! when N-1 is zero.
            $sheet->setCellValue("F{$r}", "=IF(C{$r}=0,\"\",ABS(E{$r}/C{$r}))");
            if ($withSection) {
                $sheet->setCellValue("G{$r}", $row['section']);
            }
            $r++;
        }
        $last = $r - 1;
        $lastCol = $withSection ? 'G' : 'F';

        if ($last >= 2) {
            $sheet->getStyle("A2:{$lastCol}{$last}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            $sheet->getStyle("C2:E{$last}")->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle("F2:F{$last}")->getNumberFormat()->setFormatCode('0.00%');
            if ($withSection) {
                $sheet->getStyle("G2:G{$last}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("G2:G{$last}")->getFont()->setBold(true);
            }
        }

        $this->setWidths($sheet);
        $sheet->getColumnDimension('E')->setWidth(18);
        $sheet->getColumnDimension('F')->setWidth(14);
        $sheet->getColumnDimension('G')->setWidth(14);
    }

    /** Section letters in the order they appear in the plan comptable (R, E, G, K, V, …), without duplicates. */
    public static function sectionsOrdonnees(): array
    {
        return array_values(array_unique(array_column(self::SECTIONS_AUDIT, 2)));
    }

    /** Turns each letter of the main sheet's "Section audit" column into a link to its "Section X" sheet. */
    private function linkSections($sheet, Spreadsheet $spreadsheet): void
    {
        for ($r = 2; $r <= $sheet->getHighestRow(); $r++) {
            $lettre = (string) $sheet->getCell("G{$r}")->getValue();
            if ($lettre === '' || !$spreadsheet->sheetNameExists("Section {$lettre}")) continue;
            $sheet->getCell("G{$r}")->getHyperlink()->setUrl("sheet://'Section {$lettre}'!A1")->setTooltip("Voir la section {$lettre}");
            $sheet->getStyle("G{$r}")->getFont()->setUnderline(true)->getColor()->setRGB('0563C1');
        }
    }

    /** Wide enough for amounts like -4,461,532.00 — a default-width column shows "#######". */
    private function setWidths($sheet): void
    {
        $sheet->getColumnDimension('A')->setWidth(25);
        $sheet->getColumnDimension('B')->setWidth(34.11);
        $sheet->getColumnDimension('C')->setWidth(25);
        $sheet->getColumnDimension('D')->setWidth(25);
    }

    private function writeUniquementSheet($sheet, array $headers, array $rows): void
    {
        $this->writeHeader($sheet, $headers);

        $r = 2;
        foreach ($rows as $row) {
            $this->writeRow($sheet, $r++, $row);
        }
        if ($r > 2) {
            $sheet->getStyle('C2:D' . ($r - 1))->getNumberFormat()->setFormatCode('#,##0.00');
        }

        $this->setWidths($sheet);
    }

    /**
     * Faithful port of the macro's merge-by-Compte pass: sums duplicate
     * account rows within each balance, then classifies every account as
     * present only in N-1, only in N, or in both.
     */
    private function consolidate($lignesN1, $lignesN): array
    {
        $dict = [];

        $accumulate = function ($lignes, string $key) use (&$dict) {
            foreach ($lignes as $ligne) {
                $compte = trim((string) $ligne->compte);
                if ($compte === '') continue;
                if (!isset($dict[$compte])) {
                    $dict[$compte] = ['libelle' => '', 'n_1' => 0.0, 'n' => 0.0];
                }
                if ($dict[$compte]['libelle'] === '' && $ligne->libelle) {
                    $dict[$compte]['libelle'] = $ligne->libelle;
                }
                $dict[$compte][$key] += (float) $ligne->solde;
            }
        };

        $accumulate($lignesN1, 'n_1');
        $accumulate($lignesN, 'n');

        $consolidation = [];
        foreach ($dict as $compte => $d) {
            $soldeN1 = round($d['n_1'], 3);
            $soldeN  = round($d['n'], 3);

            if ($soldeN1 != 0.0 && $soldeN == 0.0) {
                $statut = 'Présent uniquement en N-1';
            } elseif ($soldeN1 == 0.0 && $soldeN != 0.0) {
                $statut = 'Présent uniquement en N';
            } else {
                $statut = 'Présent dans les deux balances';
            }

            $consolidation[] = [
                // Numeric-looking keys come back from PHP arrays as ints; keep the text form.
                'compte'    => (string) $compte,
                'libelle'   => $d['libelle'],
                'solde_n_1' => $soldeN1,
                'solde_n'   => $soldeN,
                'variation' => round($soldeN - $soldeN1, 3),
                // Same rule as the Excel column: |variation / N-1|, null when N-1 is zero.
                'variation_pct' => $soldeN1 != 0.0 ? round(abs(($soldeN - $soldeN1) / $soldeN1) * 100, 2) : null,
                'section'   => self::sectionAudit((string) $compte),
                'statut'    => $statut,
            ];
        }

        usort($consolidation, fn ($a, $b) => strcmp($a['compte'], $b['compte']));

        $ecarts = array_values(array_filter(
            $consolidation,
            fn ($row) => $row['statut'] !== 'Présent dans les deux balances'
        ));

        return ['consolidation' => $consolidation, 'ecarts' => $ecarts];
    }

    /** Whole-file variant of balanceRows(), used to re-read stored imports. */
    private function parseBalanceFile(UploadedFile|string $file, string $type): array
    {
        $rows = $this->balanceRows($file instanceof UploadedFile ? $file->getRealPath() : $file, $type);
        return ['rows' => $rows ? iterator_to_array($rows, false) : []];
    }

    /**
     * Detects the columns from the header row and returns a generator of
     * normalized rows, or null when the required columns are missing.
     */
    private function balanceRows(string $path, string $type): ?\Generator
    {
        // For legacy .xls only the detected columns are loaded (a 14 MB grand livre
        // has 31 columns; reading 5 of them is ~5x faster and lighter).
        $lines = SpreadsheetRowReader::rows($path, fn (array $header) => array_values($this->detectColumns($header, $type) ?? []));
        if (!$lines->valid()) {
            return null;
        }

        $colIndex = $this->detectColumns($lines->current(), $type);
        if ($colIndex === null) {
            return null;
        }

        $num = fn (array $line, string $field) => isset($colIndex[$field]) ? $this->parseNumber($line[$colIndex[$field]] ?? 0) : null;

        return (function () use ($lines, $colIndex, $num, $type) {
            for ($lines->next(); $lines->valid(); $lines->next()) {
                $line = $lines->current();
                $compte = trim((string) ($line[$colIndex['compte']] ?? ''));
                if ($compte === '') continue;

                $debit  = $num($line, 'debit');
                $credit = $num($line, 'credit');

                // Balance = the Solde column, else solde débiteur − créditeur,
                // else (balances only) solde initial + débit − crédit.
                if (isset($colIndex['solde'])) {
                    $solde = $num($line, 'solde');
                } elseif (isset($colIndex['solde_d'], $colIndex['solde_c'])) {
                    $solde = round($num($line, 'solde_d') - $num($line, 'solde_c'), 3);
                } elseif ($type !== 'grand_livre' && $debit !== null && $credit !== null) {
                    $solde = round(($num($line, 'solde_ini') ?? 0) + $debit - $credit, 3);
                } else {
                    $solde = null;
                }

                yield [
                    'compte'  => $compte,
                    'libelle' => isset($colIndex['libelle']) ? trim((string) ($line[$colIndex['libelle']] ?? '')) : null,
                    'solde'   => $solde,
                    'debit'   => $debit,
                    'credit'  => $credit,
                    'date'    => isset($colIndex['date']) ? $this->parseDate($line[$colIndex['date']] ?? null) : null,
                ];
            }
        })();
    }

    /**
     * Maps fields (compte, libelle, solde, …) to 0-based column indexes from the
     * header row, or null when the columns this import type needs are missing.
     */
    private function detectColumns(array $header, string $type): ?array
    {
        $colIndex = [];
        $soldeYears = []; // plain "Solde …" columns, keyed by column index => year (or null)
        foreach ($header as $i => $label) {
            $norm = $this->normalizeHeader((string) $label);
            if ($norm === '') continue;

            foreach (self::HEADER_PATTERNS as $field => $pattern) {
                if (preg_match($pattern, $norm)) {
                    if ($field === 'solde') {
                        $soldeYears[$i] = preg_match('/\b(19|20)\d{2}\b/', $norm, $m) ? (int) $m[0] : null;
                    }
                    $colIndex[$field] ??= $i;
                    continue 2;
                }
            }
            foreach (self::HEADER_SYNONYMS as $field => $synonyms) {
                if (isset($colIndex[$field])) continue;
                foreach ($synonyms as $syn) {
                    if ($norm === $syn || str_starts_with($norm, $syn)) {
                        $colIndex[$field] = $i;
                        continue 3;
                    }
                }
            }
        }

        if (isset($colIndex['designation'])) {
            $colIndex['libelle'] = $colIndex['designation'];
            unset($colIndex['designation']);
        }

        // Like the macro's TrouverColonne(ws, "Solde 2024") / "Solde 2025": when a file
        // carries both years, balance N-1 reads the oldest year and balance N the latest.
        $dated = array_filter($soldeYears, fn ($y) => $y !== null);
        if (count($dated) > 1) {
            $colIndex['solde'] = $type === 'n_1'
                ? array_search(min($dated), $dated, true)
                : array_search(max($dated), $dated, true);
        }

        $hasSolde = isset($colIndex['solde'])
            || isset($colIndex['solde_d'], $colIndex['solde_c'])
            || isset($colIndex['debit'], $colIndex['credit']);

        if (!isset($colIndex['compte']) || ($type !== 'grand_livre' && !$hasSolde)) {
            return null;
        }

        return $colIndex;
    }

    private function normalizeHeader(string $label): string
    {
        $label = mb_strtolower(trim($label));
        $label = str_replace(['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ô', 'û', 'ù', 'ç'], ['e', 'e', 'e', 'e', 'a', 'a', 'i', 'o', 'u', 'u', 'c'], $label);
        // "solde_d", "date.ecr", "N°  compte" → single-spaced words.
        return trim(preg_replace('/[\s_.]+/', ' ', $label));
    }

    /** Mirrors the macro's CDbl(Val(Replace(text, ",", "."))) — comma-decimal safe. */
    private function parseNumber($value): float
    {
        if (is_numeric($value)) return (float) $value;
        $clean = str_replace([' ', "\xC2\xA0"], '', (string) $value);
        $clean = str_replace(',', '.', $clean);
        return is_numeric($clean) ? (float) $clean : 0.0;
    }

    private function parseDate($value): ?string
    {
        if (empty($value)) return null;
        if (is_numeric($value)) {
            try {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }
        try {
            return (new \DateTime((string) $value))->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }
}
