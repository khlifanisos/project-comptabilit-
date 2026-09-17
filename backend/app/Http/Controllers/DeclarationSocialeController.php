<?php

namespace App\Http\Controllers;

use App\Models\DeclarationSociale;
use App\Models\Administrateur;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx as XlsxWriter;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class DeclarationSocialeController extends Controller
{
    // ── List ─────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $query = DeclarationSociale::with('client')->latest();
            if ($adminEntreprise !== '') {
                $query->whereHas('client', fn($q) => $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]));
            }
            $data = $query->paginate(100);
        } else {
            $data = DeclarationSociale::where('client_id', $user->id)->latest()->paginate(100);
        }

        return response()->json($data);
    }

    // ── Show (detail) ─────────────────────────────────────────────────
    public function show(Request $request, int $id)
    {
        $decl = DeclarationSociale::with('client')->findOrFail($id);
        $this->authorizeAccess($request, $decl->client_id);
        return response()->json($decl);
    }

    // ── Create (Admin only) ───────────────────────────────────────────
    public function store(Request $request)
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            abort(403, 'Seul un administrateur peut créer une déclaration sociale.');
        }

        $validated = $request->validate([
            'client_email'    => 'required|email',
            'type'            => 'required|in:CNSS,CIMR,AMO,autre',
            'periode'         => 'required|string|max:50',
            'periode_type'    => 'required|in:mensuelle,trimestrielle',
            'date_limite'     => 'required|date',
            'nombre_employes' => 'required|integer|min:0',
            'masse_salariale' => 'required|numeric|min:0',
            'taux_cotisation' => 'required|numeric|min:0',
            'part_patronale'  => 'required|numeric|min:0',
            'part_salariale'  => 'required|numeric|min:0',
            'statut'          => 'required|in:a_declarer,deposee,validee',
            'notes'           => 'nullable|string',
            'fichier'         => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        // Validate that client email exists
        $client = Client::where('email', $validated['client_email'])->first();
        if (!$client) {
            return response()->json([
                'message' => 'Aucun client trouvé avec cet email.',
                'errors'  => ['client_email' => ['Aucun client trouvé avec cet email dans le système.']],
            ], 422);
        }

        $fichierPath = null;
        if ($request->hasFile('fichier')) {
            $fichierPath = $request->file('fichier')->store("declarations_sociales/{$client->id}", 'public');
        }

        $montant = $validated['part_patronale'] + $validated['part_salariale'];

        $decl = DeclarationSociale::create([
            'client_id'       => $client->id,
            'admin_id'        => $user->id,
            'type'            => $validated['type'],
            'periode'         => $validated['periode'],
            'periode_type'    => $validated['periode_type'],
            'date_limite'     => $validated['date_limite'],
            'nombre_employes' => $validated['nombre_employes'],
            'masse_salariale' => $validated['masse_salariale'],
            'taux_cotisation' => $validated['taux_cotisation'],
            'part_patronale'  => $validated['part_patronale'],
            'part_salariale'  => $validated['part_salariale'],
            'montant'         => $montant,
            'statut'          => $validated['statut'],
            'fichier'         => $fichierPath,
            'notes'           => $validated['notes'] ?? null,
        ]);

        // Notify the client that a declaration has been published for them
        NotificationController::sendAndNotify(
            $client->id,
            "Déclaration {$validated['type']} disponible",
            "L'administrateur a publié votre déclaration {$validated['type']} — {$validated['periode']}. Montant total : " . number_format($montant, 2, '.', ' ') . ' ' . \App\Models\Parametre::currentDevise() . '.',
            'facture'
        );

        return response()->json($decl->load('client'), 201);
    }

    // ── Update (Admin only) ───────────────────────────────────────────
    public function update(Request $request, int $id)
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            abort(403, 'Seul un administrateur peut modifier une déclaration sociale.');
        }

        $decl = DeclarationSociale::findOrFail($id);

        $decl->update($request->only([
            'type', 'periode', 'periode_type', 'date_limite',
            'nombre_employes', 'masse_salariale', 'taux_cotisation',
            'part_patronale', 'part_salariale', 'statut', 'notes',
        ]));

        $decl->montant = $decl->part_patronale + $decl->part_salariale;
        $decl->save();

        NotificationController::sendAndNotify(
            $decl->client_id,
            'Déclaration sociale mise à jour',
            "Votre déclaration {$decl->type} — {$decl->periode} a été modifiée.",
            'info'
        );

        return response()->json($decl);
    }

    // ── Delete (Admin only) ───────────────────────────────────────────
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            abort(403, 'Seul un administrateur peut supprimer une déclaration sociale.');
        }

        $decl = DeclarationSociale::findOrFail($id);

        if ($decl->fichier) {
            Storage::disk('public')->delete($decl->fichier);
        }

        $decl->delete();
        return response()->json(null, 204);
    }

    // ── Client clicks eye → record view → notify admin ────────────────
    public function markViewed(Request $request, int $id)
    {
        $user = $request->user();
        $decl = DeclarationSociale::with('client')->findOrFail($id);

        if ($user instanceof Administrateur || $user->id !== $decl->client_id) {
            abort(403);
        }

        if (!$decl->viewed_at) {
            $decl->update(['viewed_at' => now()]);
        }

        $clientName = $decl->client?->nom ?? "Client #{$decl->client_id}";
        $viewedAt   = now()->format('d/m/Y à H:i');

        NotificationController::notifyAdmins(
            "Déclaration consultée — {$clientName}",
            "Le client {$clientName} a consulté la déclaration {$decl->type} — {$decl->periode} le {$viewedAt}.",
            'info'
        );

        return response()->json(['viewed_at' => $decl->viewed_at]);
    }

    // ── Download PDF ──────────────────────────────────────────────────
    public function downloadPdf(Request $request, int $id)
    {
        $decl = DeclarationSociale::with('client')->findOrFail($id);
        $this->authorizeAccess($request, $decl->client_id);

        $typeLabels = [
            'CNSS' => 'Caisse Nationale de Sécurité Sociale',
            'CIMR' => 'Caisse Interprofessionnelle Marocaine de Retraite',
            'AMO'  => 'Assurance Maladie Obligatoire',
        ];
        $statutLabels = [
            'a_declarer' => 'À déclarer',
            'deposee'    => 'Déposée',
            'validee'    => 'Validée',
        ];

        $pdf = Pdf::loadHTML($this->buildPdfHtml($decl, $typeLabels, $statutLabels))
                  ->setPaper('a4', 'portrait');

        $safe = preg_replace('/[^a-zA-Z0-9_-]/', '_', $decl->type . '_' . $decl->periode);
        return $pdf->download("declaration_sociale_{$safe}.pdf");
    }

    // ── Serve stored attachment ───────────────────────────────────────
    public function fichier(Request $request, int $id)
    {
        $decl = DeclarationSociale::findOrFail($id);
        $this->authorizeAccess($request, $decl->client_id);

        if (!$decl->fichier || !Storage::disk('public')->exists($decl->fichier)) {
            abort(404, 'Pièce jointe non disponible.');
        }

        $path = Storage::disk('public')->path($decl->fichier);
        $mime = mime_content_type($path) ?: 'application/octet-stream';

        return response()->file($path, [
            'Content-Type'  => $mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    // ── Batch PDF export ──────────────────────────────────────────────
    public function exportPdf(Request $request)
    {
        $user = $request->user();
        $ids  = $request->input('ids', []);

        if (empty($ids)) {
            return response()->json(['message' => 'Aucun identifiant fourni.'], 422);
        }

        $query = DeclarationSociale::with('client')->whereIn('id', $ids);
        if (!($user instanceof Administrateur)) {
            $query->where('client_id', $user->id);
        }
        $decls = $query->get();

        if ($decls->isEmpty()) {
            return response()->json(['message' => 'Aucune déclaration trouvée.'], 404);
        }

        $typeLabels = [
            'CNSS' => 'Caisse Nationale de Sécurité Sociale',
            'CIMR' => 'Caisse Interprofessionnelle Marocaine de Retraite',
            'AMO'  => 'Assurance Maladie Obligatoire',
        ];
        $statutLabels = [
            'a_declarer' => 'À déclarer',
            'deposee'    => 'Déposée',
            'validee'    => 'Validée',
        ];

        // Extract <head> (CSS) + <body> from each declaration's HTML and merge into one document
        $heads  = [];
        $bodies = [];
        foreach ($decls as $i => $decl) {
            $html = $this->buildPdfHtml($decl, $typeLabels, $statutLabels);
            preg_match('/<style[^>]*>([\s\S]*?)<\/style>/i', $html, $styleMatch);
            preg_match('/<body[^>]*>([\s\S]*?)<\/body>/i', $html, $bodyMatch);
            if ($styleMatch) $heads[] = "<style>{$styleMatch[1]}</style>";
            $body = $bodyMatch[1] ?? '';
            if ($i < $decls->count() - 1) {
                $body .= '<div style="page-break-after:always;height:0;margin:0;padding:0;"></div>';
            }
            $bodies[] = $body;
        }

        $combined = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
            . implode('', $heads)
            . '</head><body>'
            . implode('', $bodies)
            . '</body></html>';

        $pdf  = Pdf::loadHTML($combined)->setPaper('a4', 'portrait');
        $safe = 'declarations_sociales_' . now()->format('Y-m-d');
        return $pdf->download("{$safe}.pdf");
    }

    // ── CSV export ────────────────────────────────────────────────────
    public function export(Request $request)
    {
        $user = $request->user();
        $rows = $user instanceof Administrateur
            ? DeclarationSociale::with('client')->get()
            : DeclarationSociale::where('client_id', $user->id)->get();

        $csv = "Type;Période;Date limite;Part patronale;Part salariale;Total;Statut\n";
        foreach ($rows as $r) {
            $csv .= "{$r->type};{$r->periode};{$r->date_limite};{$r->part_patronale};{$r->part_salariale};{$r->montant};{$r->statut}\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="declarations_sociales.csv"',
        ]);
    }

    public function exportExcel(Request $request)
    {
        try {
            $user  = $request->user();
            $query = $user instanceof Administrateur
                ? DeclarationSociale::with('client')
                : DeclarationSociale::where('client_id', $user->id);

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
            $sheet->setTitle('Déclarations Sociales');

            $typeLabels   = ['CNSS' => 'Caisse Nationale de Sécurité Sociale', 'CIMR' => 'Caisse Interprofessionnelle Marocaine de Retraite', 'AMO' => 'Assurance Maladie Obligatoire'];
            $statutLabels = ['a_declarer' => 'À déclarer', 'deposee' => 'Déposée', 'validee' => 'Validée'];

            $headers = ['Type', 'Description', 'Période', 'Type période', 'Date Limite', 'Nb. Employés', "Masse Salariale ({$devise})", 'Taux Cotisation (%)', "Part Patronale ({$devise})", "Part Salariale ({$devise})", "Total à Payer ({$devise})", 'Statut', 'Notes'];
            $cols    = count($headers);
            $lastCol = chr(64 + $cols);

            // Title
            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', 'DÉCLARATIONS SOCIALES');
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

            $r = 4;
            foreach ($rows as $row) {
                $bg = ($r % 2 === 0) ? $blueLight : $white;
                try { $dl = $row->date_limite ? \Carbon\Carbon::parse($row->date_limite)->format('d/m/Y') : ''; } catch (\Exception $e) { $dl = (string) $row->date_limite; }

                $sheet->setCellValue("A{$r}", $row->type ?? '');
                $sheet->setCellValue("B{$r}", $typeLabels[$row->type] ?? $row->type ?? '');
                $sheet->setCellValue("C{$r}", $row->periode ?? '');
                $sheet->setCellValue("D{$r}", $row->periode_type ?? '');
                $sheet->setCellValue("E{$r}", $dl);
                $sheet->setCellValue("F{$r}", (int) ($row->nombre_employes ?? 0));
                $sheet->setCellValue("G{$r}", (float) ($row->masse_salariale ?? 0));
                $sheet->setCellValue("H{$r}", (float) ($row->taux_cotisation ?? 0));
                $sheet->setCellValue("I{$r}", (float) ($row->part_patronale ?? 0));
                $sheet->setCellValue("J{$r}", (float) ($row->part_salariale ?? 0));
                $sheet->setCellValue("K{$r}", (float) ($row->montant ?? 0));
                $sheet->setCellValue("L{$r}", $statutLabels[$row->statut] ?? $row->statut);
                $sheet->setCellValue("M{$r}", $row->notes ?? '');

                $sheet->getStyle("G{$r}:K{$r}")->getNumberFormat()->setFormatCode($numFmt);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bg);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0E4F7']]],
                ]);
                $sheet->getStyle("M{$r}")->getAlignment()->setWrapText(true);
                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }

            $widths = [10, 40, 18, 16, 14, 14, 22, 20, 22, 22, 22, 14, 40];
            foreach ($widths as $i => $w) {
                $sheet->getColumnDimension(chr(65 + $i))->setWidth($w);
            }

            $writer = new XlsxWriter($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="declarations_sociales.xlsx"',
                'Cache-Control'       => 'no-cache',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    // ── PDF HTML builder ──────────────────────────────────────────────
    private function buildPdfHtml(DeclarationSociale $decl, array $typeLabels, array $statutLabels): string
    {
        $typeColor   = ['CNSS' => '#1565C0', 'CIMR' => '#7B1FA2', 'AMO' => '#2E7D32'];
        $typeLightBg = ['CNSS' => '#EFF6FF', 'CIMR' => '#FAF5FF', 'AMO' => '#F0FDF4'];
        $color     = $typeColor[$decl->type]   ?? '#334155';
        $lightBg   = $typeLightBg[$decl->type] ?? '#F8FAFF';
        $typeLabel = $typeLabels[$decl->type]   ?? $decl->type;
        $statut    = $statutLabels[$decl->statut] ?? $decl->statut;
        $client    = $decl->client;
        $date      = $decl->date_limite ? $decl->date_limite->format('d/m/Y') : '—';
        $generated = now()->format('d/m/Y à H:i');
        $ref       = 'DS-' . str_pad((string) $decl->id, 5, '0', STR_PAD_LEFT);
        $devise    = \App\Models\Parametre::currentDevise();
        $montant   = number_format($decl->montant,         2, ',', ' ') . " {$devise}";
        $patronale = number_format($decl->part_patronale,  2, ',', ' ') . " {$devise}";
        $salariale = number_format($decl->part_salariale,  2, ',', ' ') . " {$devise}";
        $masse     = number_format($decl->masse_salariale, 2, ',', ' ') . " {$devise}";
        $taux      = number_format($decl->taux_cotisation, 2, ',', ' ') . ' %';
        $employes  = $decl->nombre_employes . ' employé(s)';
        $pType     = ucfirst($decl->periode_type);

        $statutBg = ['a_declarer' => '#FFF3E0', 'deposee' => '#E3F0FF', 'validee' => '#E8F5E9'];
        $statutFg = ['a_declarer' => '#E65100', 'deposee' => '#1565C0', 'validee' => '#2E7D32'];
        $sBg = $statutBg[$decl->statut] ?? '#F3F4F6';
        $sFg = $statutFg[$decl->statut] ?? '#374151';

        $nom   = htmlspecialchars($client?->nom        ?? '—');
        $ent   = htmlspecialchars($client?->entreprise ?? '—');
        $email = htmlspecialchars($client?->email      ?? '—');
        $notes = htmlspecialchars($decl->notes         ?? '');

        ob_start(); ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; }
body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #1A202C; background: #FFFFFF; }
.hdr { background-color: <?= $color ?>; }
.hdr-inner { padding: 24px 36px 16px; }
.type-badge { display: inline-block; background-color: rgba(255,255,255,0.22); color: #FFFFFF; font-size: 9px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; padding: 3px 12px; border-radius: 2px; margin-bottom: 10px; }
.hdr-title { color: #FFFFFF; font-size: 22px; font-weight: bold; margin-bottom: 3px; }
.hdr-sub { color: rgba(255,255,255,0.82); font-size: 11px; }
.hdr-meta { background-color: rgba(0,0,0,0.2); padding: 8px 36px; }
.hdr-meta table { width: 100%; border-collapse: collapse; }
.hdr-meta td { color: rgba(255,255,255,0.88); font-size: 10px; padding: 0 3px; }
.hdr-meta td.sep { color: rgba(255,255,255,0.38); text-align: center; width: 14px; }
.hdr-meta strong { color: #FFFFFF; }
.body { padding: 26px 36px; }
.sec { margin-bottom: 22px; }
.sec-head { border-bottom: 2px solid <?= $color ?>; padding-bottom: 5px; margin-bottom: 1px; }
.sec-title { font-size: 9.5px; font-weight: bold; color: <?= $color ?>; text-transform: uppercase; letter-spacing: 1.5px; }
.itbl { width: 100%; border-collapse: collapse; }
.itbl td { padding: 8px 14px; font-size: 11px; vertical-align: middle; }
.itbl td.l { color: #64748B; width: 44%; border-right: 1px solid #E2E8F0; }
.itbl td.v { color: #1E293B; font-weight: bold; padding-left: 18px; }
.r0 { background-color: #FFFFFF; }
.r1 { background-color: #F8FAFF; }
.stat { display: inline-block; background-color: <?= $sBg ?>; color: <?= $sFg ?>; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 3px; }
.ftbl { width: 100%; border-collapse: collapse; margin-top: 8px; }
.ftbl td { padding: 10px 16px; font-size: 11.5px; }
.ftbl td.l { color: #475569; }
.ftbl td.r { text-align: right; font-weight: bold; color: #1E293B; }
.fa { background-color: <?= $lightBg ?>; }
.fb { background-color: #F1F5F9; }
.fdiv td { height: 1px; padding: 0; background-color: #CBD5E1; }
.ftot { background-color: <?= $color ?>; }
.ftot td { color: #FFFFFF; font-size: 13px; font-weight: bold; }
.notes-box { background-color: #FFFBEB; border-left: 3px solid #F59E0B; padding: 12px 16px; font-size: 11px; color: #78350F; line-height: 1.7; margin-top: 2px; }
.footer { margin-top: 36px; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: center; font-size: 9px; color: #94A3B8; line-height: 1.9; }
.footer strong { color: #64748B; }
</style>
</head>
<body>

<div class="hdr">
  <div class="hdr-inner">
    <div class="type-badge"><?= $decl->type ?></div>
    <div class="hdr-title">Déclaration Sociale</div>
    <div class="hdr-sub"><?= htmlspecialchars($typeLabel) ?></div>
  </div>
  <div class="hdr-meta">
    <table><tr>
      <td>R&eacute;f&nbsp;: <strong><?= $ref ?></strong></td>
      <td class="sep">|</td>
      <td>P&eacute;riode&nbsp;: <strong><?= htmlspecialchars($decl->periode) ?></strong></td>
      <td class="sep">|</td>
      <td>Date limite&nbsp;: <strong><?= $date ?></strong></td>
      <td class="sep">|</td>
      <td style="text-align:right">G&eacute;n&eacute;r&eacute; le&nbsp;: <strong><?= $generated ?></strong></td>
    </tr></table>
  </div>
</div>

<div class="body">

  <div class="sec">
    <div class="sec-head"><span class="sec-title">Informations Client</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Nom complet</td><td class="v"><?= $nom ?></td></tr>
      <tr class="r1"><td class="l">Entreprise</td><td class="v"><?= $ent ?></td></tr>
      <tr class="r0"><td class="l">Adresse e-mail</td><td class="v"><?= $email ?></td></tr>
      <tr class="r1"><td class="l">Effectif d&eacute;clar&eacute;</td><td class="v"><?= $employes ?></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-head"><span class="sec-title">P&eacute;riode &amp; Calendrier</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Type de p&eacute;riode</td><td class="v"><?= htmlspecialchars($pType) ?></td></tr>
      <tr class="r1"><td class="l">P&eacute;riode concern&eacute;e</td><td class="v"><?= htmlspecialchars($decl->periode) ?></td></tr>
      <tr class="r0"><td class="l">Date limite de d&eacute;p&ocirc;t</td><td class="v"><?= $date ?></td></tr>
      <tr class="r1"><td class="l">Statut de la d&eacute;claration</td><td class="v"><span class="stat"><?= htmlspecialchars($statut) ?></span></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-head"><span class="sec-title">Cotisations &amp; Montants</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Masse salariale brute</td><td class="v"><?= $masse ?></td></tr>
      <tr class="r1"><td class="l">Taux de cotisation</td><td class="v"><?= $taux ?></td></tr>
    </table>
    <table class="ftbl">
      <tr class="fa"><td class="l">Part patronale</td><td class="r"><?= $patronale ?></td></tr>
      <tr class="fb"><td class="l">Part salariale</td><td class="r"><?= $salariale ?></td></tr>
      <tr class="fdiv"><td colspan="2"></td></tr>
      <tr class="ftot"><td class="l">Total &agrave; payer</td><td class="r"><?= $montant ?></td></tr>
    </table>
  </div>

<?php if ($decl->notes): ?>
  <div class="sec">
    <div class="sec-head"><span class="sec-title">Notes &amp; Observations</span></div>
    <div class="notes-box"><?= $notes ?></div>
  </div>
<?php endif; ?>

  <div class="footer">
    <strong>Intelligence Comptabilit&eacute;</strong> &mdash; Document g&eacute;n&eacute;r&eacute; automatiquement le <?= $generated ?><br>
    Ce document est fourni &agrave; titre informatif et ne constitue pas un justificatif officiel.
  </div>

</div>
</body>
</html>
<?php return ob_get_clean();
    }

    private function authorizeAccess(Request $request, int $clientId): void
    {
        $user = $request->user();
        if (!($user instanceof Administrateur) && $user->id !== $clientId) {
            abort(403, 'Accès non autorisé.');
        }
    }
}
