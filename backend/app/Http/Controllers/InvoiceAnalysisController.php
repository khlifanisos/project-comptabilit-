<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class InvoiceAnalysisController extends Controller
{
    private const MODELS = [
        ['model' => 'gemini-2.5-flash',      'api' => 'v1beta'],
        ['model' => 'gemini-2.5-flash-lite',  'api' => 'v1beta'],
        ['model' => 'gemini-2.0-flash-lite',  'api' => 'v1beta'],
    ];

    private const PROMPT = 'You are an expert at reading invoices in any language or format.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation, nothing else.

{
  "fournisseur": "name of the seller / vendor company",
  "numero_facture": "invoice number or reference",
  "date": "invoice date as YYYY-MM-DD",
  "montant_ht": 0.00,
  "tva": 0.00,
  "montant_ttc": 0.00,
  "lignes": [
    {
      "numero": "row number or code if shown, otherwise empty string",
      "designation": "full product or service description",
      "qte": "quantity as a string e.g. 10 or 30 m², empty string if not shown",
      "prix_u": 0.00,
      "total_ht": 0.00
    }
  ],
  "resume": [
    {"label": "exact label text as shown on the invoice", "valeur": "exact value as shown (keep %, $, MAD, € symbols)"}
  ]
}

CRITICAL RULES FOR lignes:
1. Every product/service row in the table MUST become one object in lignes.
2. Column name mapping — use whatever column names appear in the invoice:
   - "Description" / "Désignation" / "Libellé" / "Produit" → designation
   - "Quantité" / "Qté" / "Qty" / "Nb" → qte
   - "Prix unitaire HT" / "Prix U." / "P.U." / "Unit price" → prix_u
   - "Total HT" / "Montant HT" / "Total TTC" (when TVA=0) / "Sous-total" → total_ht
3. If TVA = 0, map "Total TTC" to total_ht.
4. Do NOT skip any rows — include every line.
5. Use 0 for any numeric field that is missing or blank.
6. Use empty string "" for any text field that is missing or blank.

CRITICAL RULES FOR resume:
1. Capture EVERY summary/footer row that appears AFTER the product lines table, in order.
2. Include ALL of: sous-total, subtotal, remise, discount, taux de taxe, tax rate, total de taxe, TVA, expédition, manutention, transport, frais de livraison, autres frais, autre, net à payer, total, grand total, etc.
3. valeur is always a string — keep the exact value as shown including symbols (%, $, MAD, €).
4. If no summary section exists, use an empty array [].';

    public static function extractData(string $storagePath): array
    {
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey || !Storage::disk('public')->exists($storagePath)) {
            return ['lignes' => [], 'resume' => []];
        }

        $fullPath = Storage::disk('public')->path($storagePath);
        $mime     = mime_content_type($fullPath) ?: 'image/jpeg';
        $base64   = base64_encode(file_get_contents($fullPath));

        foreach (self::MODELS as ['model' => $model, 'api' => $api]) {
            $url = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";
            $genConfig = ['temperature' => 0.1, 'maxOutputTokens' => 4096];
            if ($api === 'v1beta') $genConfig['responseMimeType'] = 'application/json';

            $response = Http::withoutVerifying()->timeout(55)->post($url, [
                'contents'         => [['parts' => [
                    ['inlineData' => ['mimeType' => $mime, 'data' => $base64]],
                    ['text'       => self::PROMPT],
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
            if (!$data && preg_match('/\{[\s\S]*\}/s', $text, $m)) {
                $data = json_decode($m[0], true);
            }
            if (!$data) continue;

            $lignes = [];
            foreach ((array) ($data['lignes'] ?? []) as $l) {
                $lignes[] = [
                    'numero'      => (string) ($l['numero']      ?? ''),
                    'designation' => (string) ($l['designation'] ?? ''),
                    'qte'         => (string) ($l['qte']         ?? ''),
                    'prix_u'      => (float)  ($l['prix_u']      ?? 0),
                    'total_ht'    => (float)  ($l['total_ht']    ?? 0),
                ];
            }
            $resume = [];
            foreach ((array) ($data['resume'] ?? []) as $r) {
                $lbl = trim((string) ($r['label']  ?? ''));
                $val = trim((string) ($r['valeur'] ?? ''));
                if ($lbl !== '') $resume[] = ['label' => $lbl, 'valeur' => $val];
            }
            return ['lignes' => $lignes, 'resume' => $resume];
        }

        return ['lignes' => [], 'resume' => []];
    }

    public static function extractLignes(string $storagePath): array
    {
        return self::extractData($storagePath)['lignes'];
    }

    public function analyze(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,gif,pdf|max:10240',
        ]);

        $file   = $request->file('file');
        $mime   = $file->getMimeType();
        $base64 = base64_encode(file_get_contents($file->getRealPath()));
        $apiKey = env('GEMINI_API_KEY');

        if (!$apiKey) {
            return response()->json(['message' => 'Clé API Gemini non configurée.'], 500);
        }

        $errors = [];

        foreach (self::MODELS as ['model' => $model, 'api' => $api]) {
            $url = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";

            $genConfig = ['temperature' => 0.1, 'maxOutputTokens' => 4096];
            if ($api === 'v1beta') {
                $genConfig['responseMimeType'] = 'application/json';
            }

            $response = Http::withoutVerifying()->timeout(55)->post($url, [
                'contents' => [[
                    'parts' => [
                        ['inlineData' => ['mimeType' => $mime, 'data' => $base64]],
                        ['text' => self::PROMPT],
                    ],
                ]],
                'generationConfig' => $genConfig,
            ]);

            if (!$response->successful()) {
                $msg = $response->json('error.message') ?? "HTTP {$response->status()}";
                $errors[] = "{$model}: {$msg}";
                continue;
            }

            $text = $response->json('candidates.0.content.parts.0.text') ?? '';

            if (!$text) {
                $errors[] = "Réponse vide ({$model})";
                continue;
            }

            $data = json_decode(trim($text), true);

            if (!$data) {
                $clean = preg_replace('/```json\s*/i', '', $text);
                $clean = preg_replace('/```/', '', $clean);
                $data  = json_decode(trim($clean), true);
            }

            if (!$data && preg_match('/\{[\s\S]*\}/s', $text, $m)) {
                $data = json_decode($m[0], true);
            }

            if (!$data) {
                $errors[] = "JSON invalide ({$model}): " . mb_substr($text, 0, 120);
                continue;
            }

            // Normalize lignes
            $lignes = [];
            foreach ((array) ($data['lignes'] ?? []) as $l) {
                $lignes[] = [
                    'numero'      => (string) ($l['numero']      ?? ''),
                    'designation' => (string) ($l['designation'] ?? ''),
                    'qte'         => (string) ($l['qte']         ?? ''),
                    'prix_u'      => (float)  ($l['prix_u']      ?? 0),
                    'total_ht'    => (float)  ($l['total_ht']    ?? 0),
                ];
            }

            $resume = [];
            foreach ((array) ($data['resume'] ?? []) as $r) {
                $lbl = trim((string) ($r['label']  ?? ''));
                $val = trim((string) ($r['valeur'] ?? ''));
                if ($lbl !== '') $resume[] = ['label' => $lbl, 'valeur' => $val];
            }

            return response()->json([
                'fournisseur'    => (string) ($data['fournisseur']    ?? ''),
                'numero_facture' => (string) ($data['numero_facture'] ?? ''),
                'date'           => (string) ($data['date']           ?? ''),
                'montant_ht'     => (float)  ($data['montant_ht']     ?? 0),
                'tva'            => (float)  ($data['tva']            ?? 0),
                'montant_ttc'    => (float)  ($data['montant_ttc']    ?? 0),
                'lignes'         => $lignes,
                'resume'         => $resume,
            ]);
        }

        return response()->json([
            'message' => 'Impossible d\'analyser la facture. Erreurs : ' . implode(' | ', $errors),
        ], 422);
    }

    public function excel(Request $request)
    {
        $request->validate([
            'fournisseur'    => 'required|string|max:200',
            'date'           => 'required|string',
            'montant_ht'     => 'required|numeric|min:0',
            'tva'            => 'required|numeric|min:0',
            'montant_ttc'    => 'required|numeric|min:0',
            'numero_facture' => 'nullable|string|max:100',
            'lignes'         => 'nullable|array',
            'resume'         => 'nullable|array',
        ]);

        $fournisseur = $request->input('fournisseur');
        $date        = $request->input('date');
        $ht          = (float) $request->input('montant_ht');
        $tva         = (float) $request->input('tva');
        $ttc         = (float) $request->input('montant_ttc') ?: $ht + $tva;
        $numero      = $request->input('numero_facture', '');
        $lignes      = $request->input('lignes', []);
        $resume      = $request->input('resume', []);
        $generated   = now()->format('d/m/Y H:i');

        // Format date nicely
        try {
            $dateFormatted = \Carbon\Carbon::parse($date)->format('d/m/Y');
        } catch (\Exception $e) {
            $dateFormatted = $date;
        }

        $numFmt  = '#,##0.00';
        $devise    = \App\Models\Parametre::currentDevise();
        $blueDark  = '2D5EA8';
        $blueMid   = '4472C4';
        $blueLight = 'D6E4F0';
        $blueRow   = 'EBF5FF';
        $white     = 'FFFFFF';

        $spreadsheet = new Spreadsheet();

        // ══════════════════════════════════════════════════
        //  Sheet 1 — Detailed invoice table
        // ══════════════════════════════════════════════════
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle("Détail facture");

        // ── Row 1: Fournisseur title ──────────────────────
        $sheet->mergeCells('A1:E1');
        $sheet->setCellValue('A1', $fournisseur);
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 13],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(22);

        // ── Row 2: Invoice meta ───────────────────────────
        $sheet->setCellValue('A2', "N° Facture : {$numero}");
        $sheet->setCellValue('C2', "Date : {$dateFormatted}");
        $sheet->setCellValue('E2', "Généré le : {$generated}");
        $sheet->getStyle('A2:E2')->getFont()->setSize(10)->setItalic(true);
        $sheet->getStyle('A2:E2')->getFont()->getColor()->setRGB('555555');
        $sheet->getRowDimension(2)->setRowHeight(16);

        // ── Row 3: spacer
        $sheet->getRowDimension(3)->setRowHeight(6);

        // ── Row 4: Column headers ─────────────────────────
        $headers = ['N°', 'DÉSIGNATION', 'QTÉ', 'PRIX U.', 'TOTAL HT'];
        foreach ($headers as $i => $h) {
            $col = chr(65 + $i);
            $sheet->setCellValue("{$col}4", $h);
        }
        $sheet->getStyle('A4:E4')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $white]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(20);

        // ── Data rows ─────────────────────────────────────
        $dataStart = 5;
        $r = $dataStart;

        if (!empty($lignes)) {
            foreach ($lignes as $line) {
                $num    = $line['numero']      ?? '';
                $desc   = $line['designation'] ?? '';
                $qte    = $line['qte']         ?? '';
                $prixU  = (float) ($line['prix_u']   ?? 0);
                $totHt  = (float) ($line['total_ht'] ?? 0);

                // Section header rows (no qty/price, only total)
                $isSection = ($num !== '' && strpos($num, '.') === false && $prixU == 0 && $qte === '');

                $sheet->setCellValue("A{$r}", $num);
                $sheet->setCellValue("B{$r}", $desc);
                $sheet->setCellValue("C{$r}", $qte);
                if ($prixU != 0) {
                    $sheet->setCellValue("D{$r}", $prixU);
                    $sheet->getStyle("D{$r}")->getNumberFormat()->setFormatCode($numFmt . " \"{$devise}\"");
                    $sheet->getStyle("D{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                }
                // Always write TOTAL HT — show 0.00 MAD for empty rows
                $sheet->setCellValue("E{$r}", $totHt);
                $sheet->getStyle("E{$r}")->getNumberFormat()->setFormatCode($numFmt . " \"{$devise}\"");
                $sheet->getStyle("E{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                if ($isSection) {
                    $sheet->getStyle("A{$r}:E{$r}")->applyFromArray([
                        'font' => ['bold' => true, 'size' => 10],
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueLight]],
                    ]);
                } elseif ($r % 2 === 0) {
                    $sheet->getStyle("A{$r}:E{$r}")->getFill()
                        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F5F9FF');
                }

                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }
        } else {
            // Fallback: single summary row
            $sheet->setCellValue("A{$r}", '1');
            $sheet->setCellValue("B{$r}", "Facture {$fournisseur}");
            $sheet->setCellValue("C{$r}", '');
            $sheet->setCellValue("D{$r}", '');
            $sheet->setCellValue("E{$r}", $ht);
            $sheet->getStyle("E{$r}")->getNumberFormat()->setFormatCode($numFmt . ' "€"');
            $r++;
        }

        $dataEnd = $r - 1;

        // ── Spacer row
        $sheet->getRowDimension($r)->setRowHeight(6);
        $r++;

        // ── Summary rows (from invoice) or fallback ────────
        $summarySource = !empty($resume) ? $resume : [
            ['label' => 'Total net HT', 'valeur' => number_format($ht,  2, '.', '')],
            ['label' => 'TVA',          'valeur' => number_format($tva, 2, '.', '')],
            ['label' => 'NET À PAYER',  'valeur' => number_format($ttc, 2, '.', '')],
        ];
        foreach ($summarySource as $item) {
            $label   = strtoupper($item['label'] ?? '');
            $valeur  = $item['valeur'] ?? '';
            $isTotal = (stripos($label, 'total') !== false && stripos($label, 'sous') === false && stripos($label, 'taxe') === false)
                    || stripos($label, 'net à payer') !== false
                    || stripos($label, 'grand total') !== false;

            $sheet->mergeCells("A{$r}:D{$r}");
            $sheet->setCellValue("A{$r}", $label);
            $sheet->setCellValue("E{$r}", $valeur);

            $sheet->getStyle("A{$r}:E{$r}")->applyFromArray([
                'font' => ['bold' => true, 'size' => $isTotal ? 11 : 10, 'color' => ['rgb' => $isTotal ? $white : '1A1A2E']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $isTotal ? $blueMid : 'EEF4FB']],
            ]);
            $sheet->getStyle("A{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getStyle("E{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getRowDimension($r)->setRowHeight($isTotal ? 22 : 18);
            $r++;
        }

        // ── Borders on full table ─────────────────────────
        $sheet->getStyle("A4:E{$dataEnd}")->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'B0C4DE']]],
        ]);

        // ── Column widths ─────────────────────────────────
        $sheet->getColumnDimension('A')->setWidth(8);
        $sheet->getColumnDimension('B')->setWidth(52);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(14);
        $sheet->getColumnDimension('E')->setWidth(16);

        // Wrap text in designation column
        $sheet->getStyle("B{$dataStart}:B{$dataEnd}")->getAlignment()->setWrapText(true);

        // ══════════════════════════════════════════════════
        //  Sheet 2 — Summary
        // ══════════════════════════════════════════════════
        $sum = $spreadsheet->createSheet();
        $sum->setTitle('Résumé');

        $sum->mergeCells('A1:B1');
        $sum->setCellValue('A1', 'RÉSUMÉ DE LA FACTURE');
        $sum->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 13, 'color' => ['rgb' => $white]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sum->getRowDimension(1)->setRowHeight(28);

        $summaryItems = [
            ['Fournisseur',   $fournisseur],
            ['N° Facture',    $numero ?: '—'],
            ['Date',          $dateFormatted],
            ['Montant HT',    $ht],
            ['TVA',           $tva],
            ['Montant TTC',   $ttc],
            ['Lignes extraites', count($lignes) . ' produit(s), ' . count($resume) . ' ligne(s) résumé'],
            ['Généré le',     $generated],
        ];
        foreach ($summaryItems as $i => [$lbl, $val]) {
            $row = $i + 2;
            $sum->setCellValue("A{$row}", $lbl);
            $sum->setCellValue("B{$row}", $val);
            $sum->getStyle("A{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueRow]],
            ]);
            if (is_float($val)) {
                $sum->getStyle("B{$row}")->getNumberFormat()->setFormatCode($numFmt . ' "€"');
            }
        }
        $sum->getColumnDimension('A')->setWidth(22);
        $sum->getColumnDimension('B')->setWidth(30);

        // ── Stream ────────────────────────────────────────
        $safe     = preg_replace('/[^a-zA-Z0-9_-]/', '_', $fournisseur);
        $dateSafe = preg_replace('/[^0-9-]/', '', substr($date, 0, 10));
        $filename = "facture_{$safe}_{$dateSafe}.xlsx";

        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-cache',
        ]);
    }
}
