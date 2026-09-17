<?php

namespace App\Http\Controllers;

use App\Models\FactureAchat;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class FactureAchatController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $query = FactureAchat::with('client')->latest();
            if ($adminEntreprise !== '') {
                $query->whereHas('client', fn($q) => $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]));
            }
            $data = $query->paginate(50);
        } else {
            $data = FactureAchat::where('client_id', $user->id)->latest()->paginate(50);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fournisseur' => 'required|string|max:150',
            'date'        => 'required|date',
            'montant_ht'  => 'required|numeric|min:0',
            'tva'         => 'required|numeric|min:0',
            'montant_ttc' => 'required|numeric|min:0',
            'notes'       => 'nullable|string',
            'image'       => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,pdf|max:10240',
        ]);

        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        $clientId = $user instanceof Administrateur
            ? ($request->input('client_id') ?: $user->id)
            : $user->id;

        if (!$clientId) {
            abort(422, 'Le client associé à la facture est requis.');
        }

        $last    = FactureAchat::where('client_id', $clientId)->orderByDesc('id')->value('numero');
        $nextNum = $last ? (intval(substr($last, 4)) + 1) : 1;
        $numero  = 'ACH-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);

        $fichier = null;
        if ($request->hasFile('image')) {
            $fichier = $request->file('image')->store("factures/{$clientId}", 'public');
        }

        $facture = FactureAchat::create([
            'client_id'   => $clientId,
            'numero'      => $numero,
            'fournisseur' => $validated['fournisseur'],
            'date'        => $validated['date'],
            'montant_ht'  => $validated['montant_ht'],
            'tva'         => $validated['tva'],
            'montant_ttc' => $validated['montant_ttc'],
            'notes'       => $validated['notes'] ?? null,
            'fichier'     => $fichier,
        ]);

        NotificationController::sendAndNotify(
            $clientId,
            'Facture d\'achat enregistrée',
            "Votre facture {$numero} (fournisseur : {$validated['fournisseur']}) a bien été enregistrée.",
            'facture'
        );
        NotificationController::notifyAdmins(
            'Nouvelle facture d\'achat',
            "Le client #{$clientId} a créé la facture {$numero} (fournisseur : {$validated['fournisseur']}).",
            'facture'
        );

        return response()->json($facture, 201);
    }

    public function show(Request $request, int $id)
    {
        $facture = FactureAchat::findOrFail($id);
        $this->authorizeAccess($request, $facture->client_id);
        return response()->json($facture);
    }

    public function image(Request $request, int $id)
    {
        $facture = FactureAchat::findOrFail($id);
        $this->authorizeAccess($request, $facture->client_id);

        if (!$facture->fichier || !Storage::disk('public')->exists($facture->fichier)) {
            abort(404, 'Image non disponible.');
        }

        $path = Storage::disk('public')->path($facture->fichier);
        $mime = mime_content_type($path) ?: 'application/octet-stream';

        return response()->file($path, [
            'Content-Type'  => $mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function update(Request $request, int $id)
    {
        $facture = FactureAchat::findOrFail($id);
        $this->authorizeAccess($request, $facture->client_id);

        $facture->update($request->only(['numero', 'fournisseur', 'date', 'montant_ht', 'tva', 'montant_ttc', 'statut', 'notes']));

        NotificationController::sendAndNotify(
            $facture->client_id,
            'Facture d\'achat modifiée',
            "Votre facture {$facture->numero} a été mise à jour.",
            'info'
        );
        NotificationController::notifyAdmins(
            'Facture d\'achat modifiée',
            "La facture {$facture->numero} du client #{$facture->client_id} a été modifiée.",
            'info'
        );

        return response()->json($facture);
    }

    public function destroy(Request $request, int $id)
    {
        $facture  = FactureAchat::findOrFail($id);
        $this->authorizeAccess($request, $facture->client_id);
        $numero   = $facture->numero;
        $clientId = $facture->client_id;

        if ($facture->fichier) {
            Storage::disk('public')->delete($facture->fichier);
        }

        $facture->delete();

        NotificationController::sendAndNotify(
            $clientId,
            'Facture d\'achat supprimée',
            "La facture {$numero} a été supprimée de votre compte.",
            'alert'
        );
        NotificationController::notifyAdmins(
            'Facture d\'achat supprimée',
            "La facture {$numero} du client #{$clientId} a été supprimée.",
            'alert'
        );

        return response()->json(null, 204);
    }

    public function export(Request $request)
    {
        $user  = $request->user();
        $query = $user instanceof Administrateur
            ? FactureAchat::with('client')
            : FactureAchat::where('client_id', $user->id);

        $rows = $query->get();
        $csv  = "N° Facture;Fournisseur;Date;Montant HT;TVA;Montant TTC;Statut\n";
        foreach ($rows as $r) {
            $csv .= "{$r->numero};{$r->fournisseur};{$r->date};{$r->montant_ht};{$r->tva};{$r->montant_ttc};{$r->statut}\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="factures_achats.csv"',
        ]);
    }

    public function exportExcel(Request $request)
    {
        try {
            $user  = $request->user();
            $query = $user instanceof Administrateur
                ? FactureAchat::with('client')
                : FactureAchat::where('client_id', $user->id);

            $ids = $request->query('ids');
            if ($ids) {
                $idList = array_filter(array_map('intval', explode(',', $ids)));
                if (!empty($idList)) $query->whereIn('id', $idList);
            }

            $rows      = $query->orderBy('created_at', 'desc')->get();
            $generated = now()->format('d/m/Y H:i');

            $blueDark  = '2D5EA8';
            $blueLight = 'EBF5FF';
            $white     = 'FFFFFF';
            $numFmt    = '#,##0.00';
            $devise    = \App\Models\Parametre::currentDevise();

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Factures Achats');

            $headers = ["N\u{00b0} Facture", 'Fournisseur', 'Date', "Montant HT ({$devise})", "TVA ({$devise})", "Montant TTC ({$devise})", 'Statut'];
            $lastCol = chr(64 + count($headers));

            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', "FACTURES D\u{2019}ACHAT");
            $sheet->getStyle('A1')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 14, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(28);

            $sheet->mergeCells("A2:{$lastCol}2");
            $sheet->setCellValue('A2', "G\u{00e9}n\u{00e9}r\u{00e9} le : {$generated}  |  Total : " . $rows->count() . ' facture(s)');
            $sheet->getStyle('A2')->applyFromArray([
                'font'      => ['italic' => true, 'size' => 10, 'color' => ['rgb' => '555555']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
            $sheet->getRowDimension(2)->setRowHeight(16);

            foreach ($headers as $i => $h) {
                $sheet->setCellValue(chr(65 + $i) . '3', $h);
            }
            $sheet->getStyle("A3:{$lastCol}3")->applyFromArray([
                'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(3)->setRowHeight(20);

            $r = 4;
            foreach ($rows as $row) {
                $bg = ($r % 2 === 0) ? $blueLight : $white;
                try { $d = \Carbon\Carbon::parse($row->date)->format('d/m/Y'); } catch (\Exception $e) { $d = (string) $row->date; }
                $sheet->setCellValue("A{$r}", $row->numero ?? '');
                $sheet->setCellValue("B{$r}", $row->fournisseur ?? '');
                $sheet->setCellValue("C{$r}", $d);
                $sheet->setCellValue("D{$r}", (float) $row->montant_ht);
                $sheet->setCellValue("E{$r}", (float) $row->tva);
                $sheet->setCellValue("F{$r}", (float) $row->montant_ttc);
                $sheet->setCellValue("G{$r}", $row->statut ?? '');
                $sheet->getStyle("D{$r}:F{$r}")->getNumberFormat()->setFormatCode($numFmt);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bg);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0E4F7']]],
                ]);
                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }

            foreach ([14, 30, 14, 18, 14, 18, 14] as $i => $w) {
                $sheet->getColumnDimension(chr(65 + $i))->setWidth($w);
            }

            FactureAchat::whereIn('id', $rows->pluck('id')->toArray())->update(['statut' => 'exportee']);

            $writer = new Xlsx($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="factures_achats.xlsx"',
                'Cache-Control'       => 'no-cache',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function exportExcelAi(Request $request)
    {
        try {
            $user  = $request->user();
            $query = $user instanceof Administrateur
                ? FactureAchat::with('client')
                : FactureAchat::where('client_id', $user->id);

            $ids = $request->query('ids');
            if ($ids) {
                $idList = array_filter(array_map('intval', explode(',', $ids)));
                if (!empty($idList)) $query->whereIn('id', $idList);
            }

            $factures = $query->orderBy('date', 'desc')->get();
            if ($factures->isEmpty()) {
                return response()->json(['message' => 'Aucune facture trouvée.'], 404);
            }

            $blueDark  = '2D5EA8';
            $blueMid   = '4472C4';
            $blueLight = 'D6E4F0';
            $white     = 'FFFFFF';
            $numFmt    = '#,##0.00';
            $generated = now()->format('d/m/Y H:i');
            $devise    = \App\Models\Parametre::currentDevise();

            $spreadsheet = new Spreadsheet();
            $firstSheet  = true;

            foreach ($factures as $facture) {
                $aiData = $facture->fichier
                    ? InvoiceAnalysisController::extractData($facture->fichier)
                    : ['lignes' => [], 'resume' => []];

                $lignes      = $aiData['lignes'];
                $resume      = $aiData['resume'];
                $ht          = (float) $facture->montant_ht;
                $tva         = (float) $facture->tva;
                $ttc         = (float) $facture->montant_ttc;
                $fournisseur = $facture->fournisseur ?? '';
                $numero      = $facture->numero ?? '';
                try { $dateFmt = \Carbon\Carbon::parse($facture->date)->format('d/m/Y'); } catch (\Exception $e) { $dateFmt = (string) $facture->date; }

                if ($firstSheet) {
                    $sheet = $spreadsheet->getActiveSheet();
                    $firstSheet = false;
                } else {
                    $sheet = $spreadsheet->createSheet();
                }

                $title = mb_substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '_', $fournisseur), 0, 25);
                $sheet->setTitle($title ?: $numero);

                $sheet->mergeCells('A1:E1');
                $sheet->setCellValue('A1', $fournisseur);
                $sheet->getStyle('A1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 13],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(22);

                $sheet->setCellValue('A2', "N° Facture : {$numero}");
                $sheet->setCellValue('C2', "Date : {$dateFmt}");
                $sheet->setCellValue('E2', "Généré le : {$generated}");
                $sheet->getStyle('A2:E2')->getFont()->setSize(10)->setItalic(true);
                $sheet->getStyle('A2:E2')->getFont()->getColor()->setRGB('555555');
                $sheet->getRowDimension(2)->setRowHeight(16);
                $sheet->getRowDimension(3)->setRowHeight(6);

                foreach (['N°', 'DÉSIGNATION', 'QTÉ', 'PRIX U.', 'TOTAL HT'] as $i => $h) {
                    $sheet->setCellValue(chr(65 + $i) . '4', $h);
                }
                $sheet->getStyle('A4:E4')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $white]],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(4)->setRowHeight(20);

                $dataStart = 5;
                $r = $dataStart;

                if (!empty($lignes)) {
                    foreach ($lignes as $line) {
                        $num   = $line['numero']      ?? '';
                        $desc  = $line['designation'] ?? '';
                        $qte   = $line['qte']         ?? '';
                        $prixU = (float) ($line['prix_u']   ?? 0);
                        $totHt = (float) ($line['total_ht'] ?? 0);
                        $isSec = ($num !== '' && strpos($num, '.') === false && $prixU == 0 && $qte === '');

                        $sheet->setCellValue("A{$r}", $num);
                        $sheet->setCellValue("B{$r}", $desc);
                        $sheet->setCellValue("C{$r}", $qte);
                        if ($prixU != 0) {
                            $sheet->setCellValue("D{$r}", $prixU);
                            $sheet->getStyle("D{$r}")->getNumberFormat()->setFormatCode($numFmt . " \"{$devise}\"");
                            $sheet->getStyle("D{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                        }
                        $sheet->setCellValue("E{$r}", $totHt);
                        $sheet->getStyle("E{$r}")->getNumberFormat()->setFormatCode($numFmt . " \"{$devise}\"");
                        $sheet->getStyle("E{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                        if ($isSec) {
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
                    $sheet->setCellValue("A{$r}", '1');
                    $sheet->setCellValue("B{$r}", "Facture {$fournisseur}");
                    $sheet->setCellValue("E{$r}", $ht);
                    $sheet->getStyle("E{$r}")->getNumberFormat()->setFormatCode($numFmt . " \"{$devise}\"");
                    $r++;
                }

                $dataEnd = $r - 1;
                $sheet->getRowDimension($r)->setRowHeight(6);
                $r++;

                $summarySource = !empty($resume) ? $resume : [
                    ['label' => 'Total net HT', 'valeur' => number_format($ht,  2, '.', '')],
                    ['label' => 'TVA',           'valeur' => number_format($tva, 2, '.', '')],
                    ['label' => 'NET À PAYER',   'valeur' => number_format($ttc, 2, '.', '')],
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

                $sheet->getStyle("A4:E{$dataEnd}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'B0C4DE']]],
                ]);
                $sheet->getColumnDimension('A')->setWidth(8);
                $sheet->getColumnDimension('B')->setWidth(52);
                $sheet->getColumnDimension('C')->setWidth(14);
                $sheet->getColumnDimension('D')->setWidth(14);
                $sheet->getColumnDimension('E')->setWidth(16);
                $sheet->getStyle("B{$dataStart}:B{$dataEnd}")->getAlignment()->setWrapText(true);
            }

            FactureAchat::whereIn('id', $factures->pluck('id')->toArray())->update(['statut' => 'exportee']);

            $writer = new Xlsx($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="factures_achats_detail_' . now()->format('Y-m-d') . '.xlsx"',
                'Cache-Control'       => 'no-cache',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    private function authorizeAccess(Request $request, int $clientId): void
    {
        $user = $request->user();
        if (!($user instanceof Administrateur) && $user->id !== $clientId) {
            abort(403, 'Accès non autorisé.');
        }
    }
}
