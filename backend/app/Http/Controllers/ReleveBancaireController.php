<?php

namespace App\Http\Controllers;

use App\Models\ReleveBancaire;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class ReleveBancaireController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $query = ReleveBancaire::with('client')->latest('date');
            if ($adminEntreprise !== '') {
                $query->whereHas('client', fn($q) => $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]));
            }
            $data = $query->paginate(100);
        } else {
            $data = ReleveBancaire::where('client_id', $user->id)->latest('date')->paginate(100);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'banque'   => 'required|string|max:100',
            'compte'   => 'nullable|string|max:50',
            'date'     => 'required|date',
            'libelle'  => 'required|string|max:255',
            'debit'    => 'required|numeric|min:0',
            'credit'   => 'required|numeric|min:0',
            'solde'    => 'required|numeric',
            'rapproche'=> 'boolean',
        ]);

        $user     = $request->user();
        $clientId = $user instanceof Administrateur
            ? $request->input('client_id')
            : $user->id;

        if (!$clientId) {
            return response()->json([
                'message' => 'Cette fonctionnalité est réservée aux comptes clients. Connectez-vous avec un compte client.',
            ], 403);
        }

        $releve = ReleveBancaire::create(array_merge($validated, ['client_id' => $clientId]));

        NotificationController::sendAndNotify(
            $clientId,
            'Nouveau mouvement bancaire',
            "Mouvement du {$validated['date']} enregistré : {$validated['libelle']}.",
            'info'
        );

        return response()->json($releve, 201);
    }

    public function update(Request $request, int $id)
    {
        $releve = ReleveBancaire::findOrFail($id);
        $this->authorizeAccess($request, $releve->client_id);

        $releve->update($request->only(['banque', 'compte', 'date', 'libelle', 'debit', 'credit', 'solde', 'rapproche']));

        return response()->json($releve);
    }

    public function destroy(Request $request, int $id)
    {
        $releve = ReleveBancaire::findOrFail($id);
        $this->authorizeAccess($request, $releve->client_id);
        $releve->delete();

        return response()->json(null, 204);
    }

    public function export(Request $request)
    {
        $user  = $request->user();
        $rows  = $user instanceof Administrateur
            ? ReleveBancaire::with('client')->get()
            : ReleveBancaire::where('client_id', $user->id)->get();

        $csv = "Date;Libellé;Débit;Crédit;Solde;Rapproché\n";
        foreach ($rows as $r) {
            $rapproche = $r->rapproche ? 'Oui' : 'Non';
            $csv .= "{$r->date};{$r->libelle};{$r->debit};{$r->credit};{$r->solde};{$rapproche}\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="releves_bancaires.csv"',
        ]);
    }

    public function exportExcel(Request $request)
    {
        try {
            $user = $request->user();
            $rows = $user instanceof Administrateur
                ? ReleveBancaire::with('client')->latest('date')->get()
                : ReleveBancaire::where('client_id', $user->id)->latest('date')->get();

            $blueDark  = '2D5EA8';
            $blueLight = 'EBF5FF';
            $white     = 'FFFFFF';
            $numFmt    = '#,##0.00';
            $generated = now()->format('d/m/Y H:i');
            $devise    = \App\Models\Parametre::currentDevise();

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Relevés Bancaires');

            $headers = ['Date', 'Banque', 'Compte', 'Libellé', "Débit ({$devise})", "Crédit ({$devise})", "Solde ({$devise})", 'Rapproché'];
            $cols    = count($headers);
            $lastCol = chr(64 + $cols);

            // Title
            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', 'RELEVÉS BANCAIRES');
            $sheet->getStyle('A1')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 14, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(28);

            // Subtitle
            $sheet->mergeCells("A2:{$lastCol}2");
            $sheet->setCellValue('A2', "Généré le : {$generated}  |  Total : " . $rows->count() . ' enregistrement(s)');
            $sheet->getStyle('A2')->applyFromArray([
                'font'      => ['italic' => true, 'size' => 10, 'color' => ['rgb' => '555555']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
            $sheet->getRowDimension(2)->setRowHeight(16);

            // Column headers
            foreach ($headers as $i => $h) {
                $sheet->setCellValue(chr(65 + $i) . '3', $h);
            }
            $sheet->getStyle("A3:{$lastCol}3")->applyFromArray([
                'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(3)->setRowHeight(20);

            // Data rows
            $r = 4;
            foreach ($rows as $row) {
                $bg = ($r % 2 === 0) ? $blueLight : $white;
                $sheet->setCellValue("A{$r}", $row->date ? \Carbon\Carbon::parse($row->date)->format('d/m/Y') : '');
                $sheet->setCellValue("B{$r}", $row->banque ?? '');
                $sheet->setCellValue("C{$r}", $row->compte ?? '');
                $sheet->setCellValue("D{$r}", $row->libelle ?? '');
                $sheet->setCellValue("E{$r}", (float) $row->debit);
                $sheet->setCellValue("F{$r}", (float) $row->credit);
                $sheet->setCellValue("G{$r}", (float) $row->solde);
                $sheet->setCellValue("H{$r}", $row->rapproche ? 'Oui' : 'Non');

                $sheet->getStyle("E{$r}:G{$r}")->getNumberFormat()->setFormatCode($numFmt);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bg);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0E4F7']]],
                ]);
                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }

            // Column widths
            $widths = [14, 20, 18, 40, 15, 15, 15, 12];
            foreach ($widths as $i => $w) {
                $sheet->getColumnDimension(chr(65 + $i))->setWidth($w);
            }

            $writer = new Xlsx($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            // Mark as rapproché only when an admin downloads (signals the admin has reviewed it)
            if ($user instanceof Administrateur) {
                ReleveBancaire::whereIn('id', $rows->pluck('id')->toArray())
                    ->update(['rapproche' => true]);
            }

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="releves_bancaires.xlsx"',
                'Cache-Control'       => 'no-cache',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function importFile(Request $request)
    {
        $request->validate([
            'banque' => 'required|string|max:100',
            'file'   => 'required|file|mimes:jpg,jpeg,png,webp,gif,pdf|max:10240',
        ]);

        $user = $request->user();

        if ($user instanceof Administrateur) {
            return response()->json(['message' => 'Veuillez vous connecter avec un compte client pour importer un relevé.'], 403);
        }

        $clientId = $user->id;

        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json(['message' => 'Clé API Gemini non configurée.'], 500);
        }

        $file   = $request->file('file');
        $mime   = $file->getMimeType();
        $base64 = base64_encode(file_get_contents($file->getRealPath()));

        $prompt = 'You are an expert at reading bank statements in any language or format.
Return ONLY a valid JSON array — no markdown, no code fences, no explanation.

[
  {
    "date": "YYYY-MM-DD",
    "libelle": "transaction description",
    "debit": 0.00,
    "credit": 0.00,
    "solde": 0.00
  }
]

Rules:
1. Each transaction row in the bank statement = one object in the array.
2. date must be in YYYY-MM-DD format. Convert any other format.
3. debit = amount withdrawn (positive number, 0 if none).
4. credit = amount deposited (positive number, 0 if none).
5. solde = running balance after the transaction (can be negative).
6. libelle = full transaction description/label.
7. Return [] if no transactions are found.';

        $models = [
            ['model' => 'gemini-2.5-flash',      'api' => 'v1beta'],
            ['model' => 'gemini-2.5-flash-lite',  'api' => 'v1beta'],
            ['model' => 'gemini-2.0-flash-lite',  'api' => 'v1beta'],
        ];

        $transactions = null;
        foreach ($models as ['model' => $model, 'api' => $api]) {
            $url       = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";
            $genConfig = ['temperature' => 0.1, 'maxOutputTokens' => 8192];
            if ($api === 'v1beta') $genConfig['responseMimeType'] = 'application/json';

            $response = Http::withoutVerifying()->timeout(55)->post($url, [
                'contents'         => [['parts' => [
                    ['inlineData' => ['mimeType' => $mime, 'data' => $base64]],
                    ['text'       => $prompt],
                ]]],
                'generationConfig' => $genConfig,
            ]);

            if (!$response->successful()) continue;
            $text = $response->json('candidates.0.content.parts.0.text') ?? '';
            if (!$text) continue;

            $data = json_decode(trim($text), true);
            if (!$data) {
                $clean = preg_replace('/```json\s*/i', '', $text);
                $clean = preg_replace('/```/', '', $clean);
                $data  = json_decode(trim($clean), true);
            }
            if (!$data && preg_match('/\[[\s\S]*\]/s', $text, $m)) {
                $data = json_decode($m[0], true);
            }
            if (is_array($data)) { $transactions = $data; break; }
        }

        if ($transactions === null) {
            return response()->json(['message' => 'Impossible d\'analyser le relevé bancaire.'], 422);
        }

        $banque   = $request->input('banque');
        $imported = 0;

        foreach ($transactions as $t) {
            $date    = $this->normaliseDateStr((string) ($t['date']    ?? ''));
            $libelle = trim((string) ($t['libelle'] ?? ''));
            $debit   = (float) ($t['debit']  ?? 0);
            $credit  = (float) ($t['credit'] ?? 0);
            $solde   = (float) ($t['solde']  ?? 0);

            if (!$date || !$libelle) continue;

            ReleveBancaire::create([
                'client_id' => $clientId,
                'banque'    => $banque,
                'date'      => $date,
                'libelle'   => $libelle,
                'debit'     => $debit,
                'credit'    => $credit,
                'solde'     => $solde,
                'rapproche' => false,
            ]);
            $imported++;
        }

        if ($imported === 0) {
            return response()->json(['message' => 'Aucun mouvement trouvé dans le document.'], 422);
        }

        NotificationController::sendAndNotify(
            $clientId,
            'Relevé bancaire importé',
            "{$imported} mouvement(s) importé(s) depuis votre relevé bancaire.",
            'info'
        );

        return response()->json(['imported' => $imported]);
    }

    private function normaliseDateStr(string $raw): string
    {
        $dateOnly = trim(preg_split('/[ T]/', $raw)[0]);
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $dateOnly, $m)) {
            return "{$m[3]}-{$m[2]}-{$m[1]}";
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOnly)) return $dateOnly;
        return $dateOnly;
    }

    private function authorizeAccess(Request $request, int $clientId): void
    {
        $user = $request->user();
        if (!($user instanceof Administrateur) && $user->id !== $clientId) {
            abort(403, 'Accès non autorisé.');
        }
    }
}