<?php

namespace App\Http\Controllers;

use App\Models\DeclarationFiscale;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class DeclarationFiscaleController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $query = DeclarationFiscale::with('client')->latest();
            if ($adminEntreprise !== '') {
                $query->whereHas('client', fn($q) => $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]));
            }
            $data = $query->paginate(100);
        } else {
            $data = DeclarationFiscale::where('client_id', $user->id)->latest()->paginate(100);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type'        => 'required|in:TVA,IS,IR,autre',
            'periode'     => 'required|string|max:50',
            'date_limite' => 'required|date',
            'montant'     => 'required|numeric|min:0',
            'statut'      => 'required|in:a_declarer,deposee,validee',
            'notes'       => 'nullable|string',
        ]);

        $user     = $request->user();

        if ($user instanceof Administrateur) {
            // Admin can create on behalf of their own client account (same email)
            $clientId = $request->input('client_id');
            if (!$clientId) {
                $clientAccount = \App\Models\Client::where('email', $user->email)->first();
                $clientId      = $clientAccount?->id;
            }
            if (!$clientId) {
                return response()->json([
                    'message' => 'Aucun compte client associé à cet administrateur.',
                ], 422);
            }
        } else {
            $clientId = $user->id;
        }

        $decl = DeclarationFiscale::create(array_merge($validated, ['client_id' => $clientId]));

        NotificationController::sendAndNotify(
            $clientId,
            'Déclaration fiscale enregistrée',
            "Déclaration {$validated['type']} — {$validated['periode']} créée avec succès.",
            'info'
        );
        NotificationController::notifyAdmins(
            'Nouvelle déclaration fiscale',
            "Client #{$clientId} — {$validated['type']} {$validated['periode']} enregistrée.",
            'info'
        );

        return response()->json($decl, 201);
    }

    public function update(Request $request, int $id)
    {
        $decl = DeclarationFiscale::findOrFail($id);
        $this->authorizeAccess($request, $decl->client_id);

        $decl->update($request->only(['type', 'periode', 'date_limite', 'montant', 'statut', 'notes']));

        NotificationController::sendAndNotify(
            $decl->client_id,
            'Déclaration fiscale mise à jour',
            "La déclaration {$decl->type} — {$decl->periode} a été modifiée.",
            'info'
        );

        return response()->json($decl);
    }

    public function destroy(Request $request, int $id)
    {
        $decl = DeclarationFiscale::findOrFail($id);
        $this->authorizeAccess($request, $decl->client_id);
        $decl->delete();

        return response()->json(null, 204);
    }

    public function export(Request $request)
    {
        $user = $request->user();
        $rows = $user instanceof Administrateur
            ? DeclarationFiscale::with('client')->get()
            : DeclarationFiscale::where('client_id', $user->id)->get();

        $csv = "Type;Période;Date limite;Montant;Statut\n";
        foreach ($rows as $r) {
            $csv .= "{$r->type};{$r->periode};{$r->date_limite};{$r->montant};{$r->statut}\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="declarations_fiscales.csv"',
        ]);
    }

    public function exportExcel(Request $request)
    {
        try {
            $user  = $request->user();
            $query = $user instanceof Administrateur
                ? DeclarationFiscale::with('client')
                : DeclarationFiscale::where('client_id', $user->id);

            $ids = $request->query('ids');
            if ($ids) {
                $idList = array_filter(array_map('intval', explode(',', $ids)));
                if (!empty($idList)) $query->whereIn('id', $idList);
            }

            $rows = $query->latest()->get();

            $blueDark  = '2D5EA8';
            $blueLight = 'EBF5FF';
            $white     = 'FFFFFF';
            $numFmt    = '#,##0.00';
            $generated = now()->format('d/m/Y H:i');
            $devise    = \App\Models\Parametre::currentDevise();

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Déclarations Fiscales');

            $headers = ['Type', 'Période', 'Date Limite', "Montant ({$devise})", 'Statut', 'Notes'];
            $cols    = count($headers);
            $lastCol = chr(64 + $cols);

            // Title
            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', 'DÉCLARATIONS FISCALES');
            $sheet->getStyle('A1')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 14, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(28);

            // Subtitle
            $sheet->mergeCells("A2:{$lastCol}2");
            $sheet->setCellValue('A2', "Généré le : {$generated}  |  Total : " . $rows->count() . ' déclaration(s)');
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

            $statutLabels = ['a_declarer' => 'À déclarer', 'deposee' => 'Déposée', 'validee' => 'Validée'];

            $r = 4;
            foreach ($rows as $row) {
                $bg = ($r % 2 === 0) ? $blueLight : $white;
                $sheet->setCellValue("A{$r}", $row->type ?? '');
                $sheet->setCellValue("B{$r}", $row->periode ?? '');
                $sheet->setCellValue("C{$r}", $row->date_limite ? \Carbon\Carbon::parse($row->date_limite)->format('d/m/Y') : '');
                $sheet->setCellValue("D{$r}", (float) $row->montant);
                $sheet->setCellValue("E{$r}", $statutLabels[$row->statut] ?? $row->statut);
                $sheet->setCellValue("F{$r}", $row->notes ?? '');

                $sheet->getStyle("D{$r}")->getNumberFormat()->setFormatCode($numFmt);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bg);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0E4F7']]],
                ]);
                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }

            $widths = [12, 20, 16, 18, 16, 40];
            foreach ($widths as $i => $w) {
                $sheet->getColumnDimension(chr(65 + $i))->setWidth($w);
            }

            $writer = new Xlsx($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="declarations_fiscales.xlsx"',
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