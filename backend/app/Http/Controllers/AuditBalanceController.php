<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\AuditBalanceImport;
use App\Models\AuditBalanceLigne;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
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
    private const HEADER_SYNONYMS = [
        'compte'  => ['compte', 'n° compte', 'numero de compte', 'code compte'],
        'libelle' => ['libelle', 'libellé', 'intitule', 'intitulé'],
        'solde'   => ['solde'],
        'date'    => ['date', "date d'operation", 'date operation', 'date piece'],
        'debit'   => ['debit', 'débit'],
        'credit'  => ['credit', 'crédit'],
    ];

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
            'fichier' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => "Aucun client sélectionné."], 422);
        }

        /** @var UploadedFile $file */
        $file = $request->file('fichier');

        try {
            $parsed = $this->parseBalanceFile($file, $type);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Impossible de lire ce fichier : " . $e->getMessage(),
            ], 422);
        }

        if (empty($parsed['rows'])) {
            $need = $type === 'grand_livre' ? 'Compte' : 'Compte et Solde';
            return response()->json([
                'message' => "Colonnes obligatoires introuvables ou fichier vide. Vérifiez les en-têtes : {$need}.",
            ], 422);
        }

        $path = $file->store("audit_balances/{$clientId}/{$type}", 'public');

        $import = AuditBalanceImport::updateOrCreate(
            ['client_id' => $clientId, 'type' => $type],
            [
                'nom_fichier' => $file->getClientOriginalName(),
                'fichier'     => $path,
                'nb_lignes'   => count($parsed['rows']),
            ]
        );

        // Replace previous rows (re-upload overwrites, matching the macro's wsC.Cells.Clear reset).
        $import->lignes()->delete();
        foreach (array_chunk($parsed['rows'], 500) as $chunk) {
            $import->lignes()->createMany(array_map(fn ($r) => [
                'compte'         => $r['compte'],
                'libelle'        => $r['libelle'] ?? null,
                'solde'          => $r['solde'] ?? null,
                'date_operation' => $r['date'] ?? null,
                'debit'          => $r['debit'] ?? null,
                'credit'         => $r['credit'] ?? null,
            ], $chunk));
        }

        return response()->json([
            'message' => self::LABELS[$type] . ' importée (' . count($parsed['rows']) . ' lignes).',
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
     * Excel export matching the "Balance_Consolidee_Expert" reference workbook:
     * one sheet with every account (Compte/Libelle/Solde N-1/Solde N/Variation,
     * where Variation = Solde N - Solde N-1 — zero when both balances agree),
     * plus two sheets isolating the accounts found in only one of the balances.
     */
    public function exportConsolidation(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        $imports = AuditBalanceImport::where('client_id', $clientId)->whereIn('type', ['n', 'n_1'])->get()->keyBy('type');

        if (!$imports->has('n') || !$imports->has('n_1')) {
            return response()->json(['message' => 'Importez la balance N et la balance N-1 avant de générer la consolidation.'], 422);
        }

        ['consolidation' => $consolidation, 'ecarts' => $ecarts] = $this->consolidate(
            $imports['n_1']->lignes()->get(),
            $imports['n']->lignes()->get()
        );

        $uniquementN1 = array_values(array_filter($ecarts, fn ($r) => $r['statut'] === 'Présent uniquement en N-1'));
        $uniquementN  = array_values(array_filter($ecarts, fn ($r) => $r['statut'] === 'Présent uniquement en N'));

        $spreadsheet = new Spreadsheet();
        $this->writeSheet($spreadsheet->getActiveSheet()->setTitle('Balance consolidée'), $consolidation, true);
        $this->writeSheet($spreadsheet->createSheet()->setTitle('Uniquement N-1'), $uniquementN1, false);
        $this->writeSheet($spreadsheet->createSheet()->setTitle('Uniquement N'), $uniquementN, false);
        $spreadsheet->setActiveSheetIndex(0);

        $filename = 'consolidation_balances_' . now()->format('Y-m-d_His') . '.xlsx';
        $tmp = tempnam(sys_get_temp_dir(), 'conso');
        (new Xlsx($spreadsheet))->save($tmp);

        return response()->download($tmp, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** $withVariation adds the "Solde N - Solde N-1" column (E) used on the main sheet only. */
    private function writeSheet($sheet, array $rows, bool $withVariation): void
    {
        $headers = $withVariation
            ? ['Compte', 'Libelle', 'Solde N-1', 'Solde N', 'Variation']
            : ['Compte', 'Libelle', 'Solde N-1', 'Solde N'];
        $lastCol = $withVariation ? 'E' : 'D';
        $sheet->fromArray($headers, null, 'A1');

        $sheet->getStyle("A1:{$lastCol}1")->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle("A1:{$lastCol}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1F4E79');

        $r = 2;
        foreach ($rows as $row) {
            $sheet->setCellValue("A{$r}", $row['compte']);
            $sheet->setCellValue("B{$r}", $row['libelle']);
            $sheet->setCellValue("C{$r}", $row['solde_n_1']);
            $sheet->setCellValue("D{$r}", $row['solde_n']);
            if ($withVariation) {
                $sheet->setCellValue("E{$r}", $row['variation']);
            }
            $r++;
        }

        $last = $r - 1;
        if ($last >= 2) {
            $numCols = $withVariation ? "C2:E{$last}" : "C2:D{$last}";
            $sheet->getStyle($numCols)->getNumberFormat()->setFormatCode('#,##0.000;[Red](#,##0.000);-');
            $sheet->getStyle("A1:{$lastCol}{$last}")->getBorders()->getAllBorders()
                ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('DCDCDC');
        }
        foreach (range('A', $lastCol) as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
        $sheet->setAutoFilter("A1:{$lastCol}1");
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
                'compte'    => $compte,
                'libelle'   => $d['libelle'],
                'solde_n_1' => $soldeN1,
                'solde_n'   => $soldeN,
                'variation' => round($soldeN - $soldeN1, 3),
                'statut'    => $statut,
            ];
        }

        $ecarts = array_values(array_filter(
            $consolidation,
            fn ($row) => $row['statut'] !== 'Présent dans les deux balances'
        ));

        return ['consolidation' => $consolidation, 'ecarts' => $ecarts];
    }

    /** Loads an uploaded balance/grand-livre file and extracts rows by auto-detected header. */
    private function parseBalanceFile(UploadedFile $file, string $type): array
    {
        $spreadsheet = IOFactory::load($file->getRealPath());
        $sheet = $spreadsheet->getActiveSheet();
        $grid = $sheet->toArray(null, true, true, false);

        if (empty($grid)) {
            return ['rows' => []];
        }

        $headerRow = array_shift($grid);
        $colIndex = [];
        foreach ($headerRow as $i => $label) {
            $norm = $this->normalizeHeader((string) $label);
            foreach (self::HEADER_SYNONYMS as $field => $synonyms) {
                if (isset($colIndex[$field])) continue;
                foreach ($synonyms as $syn) {
                    if ($norm === $syn || str_starts_with($norm, $syn)) {
                        $colIndex[$field] = $i;
                        break 2;
                    }
                }
            }
        }

        $hasCompte = isset($colIndex['compte']);
        $hasSolde  = isset($colIndex['solde']);

        if (!$hasCompte || ($type !== 'grand_livre' && !$hasSolde)) {
            return ['rows' => []];
        }

        $rows = [];
        foreach ($grid as $line) {
            $compte = trim((string) ($line[$colIndex['compte']] ?? ''));
            if ($compte === '') continue;

            $rows[] = [
                'compte'  => $compte,
                'libelle' => isset($colIndex['libelle']) ? trim((string) ($line[$colIndex['libelle']] ?? '')) : null,
                'solde'   => $hasSolde ? $this->parseNumber($line[$colIndex['solde']] ?? 0) : null,
                'debit'   => isset($colIndex['debit'])  ? $this->parseNumber($line[$colIndex['debit']] ?? 0)  : null,
                'credit'  => isset($colIndex['credit']) ? $this->parseNumber($line[$colIndex['credit']] ?? 0) : null,
                'date'    => isset($colIndex['date']) ? $this->parseDate($line[$colIndex['date']] ?? null) : null,
            ];
        }

        return ['rows' => $rows];
    }

    private function normalizeHeader(string $label): string
    {
        $label = mb_strtolower(trim($label));
        return str_replace(['é', 'è', 'ê'], 'e', $label);
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
