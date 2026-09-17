<?php

namespace App\Http\Controllers;

use App\Models\EcheancierLeasing;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx as XlsxWriter;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

class EcheancierLeasingController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $query = EcheancierLeasing::with('client')->latest();
            if ($adminEntreprise !== '') {
                $query->whereHas('client', fn($q) => $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]));
            }
            $data = $query->paginate(100);
        } else {
            $data = EcheancierLeasing::where('client_id', $user->id)->latest()->paginate(100);
        }
        return response()->json($data);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $adminRules = $user instanceof Administrateur
            ? ['client_id' => 'required|integer|exists:clients,id']
            : [];

        $validated = $request->validate(array_merge($adminRules, [
            'bien'               => 'required|string|max:200',
            'description_bien'   => 'nullable|string|max:300',
            'bailleur'           => 'required|string|max:150',
            'date_debut'         => 'required|date',
            'date_fin'           => 'required|date|after:date_debut',
            'mensualite'         => 'required|numeric|min:0',
            'nombre_mensualites' => 'nullable|integer|min:0',
            'option_achat'       => 'nullable|numeric|min:0',
            'valeur_achat'       => 'nullable|numeric|min:0',
            'capital_restant_du' => 'nullable|numeric|min:0',
            'taux_interet'       => 'nullable|numeric|min:0',
            'tva_loyers'         => 'nullable|numeric|min:0',
            'total_loyers'       => 'nullable|numeric|min:0',
            'prochaine_echeance' => 'required|date',
            'statut'             => 'required|in:actif,solde,en_retard,a_venir',
            'notes'              => 'nullable|string',
            'fichier'            => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]));

        $clientId = $user instanceof Administrateur
            ? (int) $validated['client_id']
            : $user->id;

        $fichierPath = null;
        if ($request->hasFile('fichier')) {
            $fichierPath = $request->file('fichier')->store('leasing', 'public');
        }

        $count = EcheancierLeasing::where('client_id', $clientId)->count();
        $ref   = 'LEA-' . str_pad($count + 1, 5, '0', STR_PAD_LEFT);

        $leasing = EcheancierLeasing::create(array_merge($validated, [
            'client_id'   => $clientId,
            'contrat_ref' => $ref,
            'fichier'     => $fichierPath,
        ]));

        NotificationController::sendAndNotify(
            $clientId,
            'Contrat de leasing enregistré',
            "Contrat {$ref} — {$validated['bien']} (bailleur : {$validated['bailleur']}) ajouté.",
            'info'
        );
        NotificationController::notifyAdmins(
            'Nouveau contrat leasing',
            "Client #{$clientId} — contrat {$ref} ({$validated['bien']}) enregistré.",
            'info'
        );

        return response()->json($leasing->load('client'), 201);
    }

    public function update(Request $request, int $id)
    {
        $leasing = EcheancierLeasing::findOrFail($id);
        $this->authorizeAccess($request, $leasing->client_id);

        $validated = $request->validate([
            'contrat_ref'        => 'sometimes|string|max:100',
            'bien'               => 'sometimes|string|max:200',
            'description_bien'   => 'nullable|string|max:300',
            'bailleur'           => 'sometimes|string|max:150',
            'date_debut'         => 'sometimes|date',
            'date_fin'           => 'sometimes|date',
            'mensualite'         => 'sometimes|numeric|min:0',
            'nombre_mensualites' => 'nullable|integer|min:0',
            'option_achat'       => 'nullable|numeric|min:0',
            'valeur_achat'       => 'nullable|numeric|min:0',
            'capital_restant_du' => 'nullable|numeric|min:0',
            'taux_interet'       => 'nullable|numeric|min:0',
            'tva_loyers'         => 'nullable|numeric|min:0',
            'total_loyers'       => 'nullable|numeric|min:0',
            'prochaine_echeance' => 'sometimes|date',
            'statut'             => 'sometimes|in:actif,solde,en_retard,a_venir',
            'notes'              => 'nullable|string',
            'fichier'            => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        if ($request->hasFile('fichier')) {
            if ($leasing->fichier) Storage::disk('public')->delete($leasing->fichier);
            $validated['fichier'] = $request->file('fichier')->store('leasing', 'public');
        }

        $leasing->update($validated);

        NotificationController::sendAndNotify(
            $leasing->client_id,
            'Contrat leasing mis à jour',
            "Le contrat {$leasing->contrat_ref} a été modifié.",
            'info'
        );

        return response()->json($leasing->load('client'));
    }

    public function destroy(Request $request, int $id)
    {
        $leasing  = EcheancierLeasing::findOrFail($id);
        $this->authorizeAccess($request, $leasing->client_id);
        $ref      = $leasing->contrat_ref;
        $clientId = $leasing->client_id;
        if ($leasing->fichier) Storage::disk('public')->delete($leasing->fichier);
        $leasing->delete();

        NotificationController::sendAndNotify(
            $clientId,
            'Contrat leasing supprimé',
            "Le contrat {$ref} a été supprimé.",
            'alert'
        );

        return response()->json(null, 204);
    }

    public function export(Request $request)
    {
        $user = $request->user();
        $rows = $user instanceof Administrateur
            ? EcheancierLeasing::with('client')->get()
            : EcheancierLeasing::where('client_id', $user->id)->get();

        $csv = "Réf.;Bien;Bailleur;Début;Fin;Mensualité;Option achat;Prochaine échéance;Statut\n";
        foreach ($rows as $r) {
            $csv .= "{$r->contrat_ref};{$r->bien};{$r->bailleur};{$r->date_debut};{$r->date_fin};{$r->mensualite};{$r->option_achat};{$r->prochaine_echeance};{$r->statut}\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="echeanciers_leasing.csv"',
        ]);
    }

    public function exportExcel(Request $request)
    {
        try {
            $user = $request->user();
            $rows = $user instanceof Administrateur
                ? EcheancierLeasing::with('client')->latest()->get()
                : EcheancierLeasing::where('client_id', $user->id)->latest()->get();

            $blueDark  = '2D5EA8';
            $blueLight = 'EBF5FF';
            $white     = 'FFFFFF';
            $numFmt    = '#,##0.00';
            $generated = now()->format('d/m/Y H:i');
            $devise    = \App\Models\Parametre::currentDevise();

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Échéancier Leasing');

            $headers = ['Réf.', 'Bien', 'Bailleur', 'Début', 'Fin', "Mensualité ({$devise})", "Option Achat ({$devise})", 'Prochaine Échéance', 'Statut'];
            $cols    = count($headers);
            $lastCol = chr(64 + $cols);

            // Title
            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', 'ÉCHÉANCIER LEASING');
            $sheet->getStyle('A1')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 14, 'color' => ['rgb' => $white]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $blueDark]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(28);

            // Subtitle
            $sheet->mergeCells("A2:{$lastCol}2");
            $sheet->setCellValue('A2', "Généré le : {$generated}  |  Total : " . $rows->count() . ' contrat(s)');
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

            $statutLabels = ['actif' => 'En cours', 'solde' => 'Soldé', 'en_retard' => 'En retard', 'a_venir' => 'À venir'];

            $r = 4;
            foreach ($rows as $row) {
                $bg = ($r % 2 === 0) ? $blueLight : $white;
                $sheet->setCellValue("A{$r}", $row->contrat_ref ?? '');
                $sheet->setCellValue("B{$r}", $row->bien ?? '');
                $sheet->setCellValue("C{$r}", $row->bailleur ?? '');
                $sheet->setCellValue("D{$r}", $row->date_debut ? $row->date_debut->format('d/m/Y') : '');
                $sheet->setCellValue("E{$r}", $row->date_fin ? $row->date_fin->format('d/m/Y') : '');
                $sheet->setCellValue("F{$r}", (float) ($row->mensualite ?? 0));
                $sheet->setCellValue("G{$r}", $row->option_achat ? (float) $row->option_achat : '—');
                $sheet->setCellValue("H{$r}", $row->prochaine_echeance ? $row->prochaine_echeance->format('d/m/Y') : '');
                $sheet->setCellValue("I{$r}", $statutLabels[$row->statut] ?? $row->statut);

                $sheet->getStyle("F{$r}")->getNumberFormat()->setFormatCode($numFmt);
                if ($row->option_achat) {
                    $sheet->getStyle("G{$r}")->getNumberFormat()->setFormatCode($numFmt);
                }
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bg);
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0E4F7']]],
                ]);
                $sheet->getRowDimension($r)->setRowHeight(18);
                $r++;
            }

            $widths = [14, 30, 22, 14, 14, 18, 18, 20, 14];
            foreach ($widths as $i => $w) {
                $sheet->getColumnDimension(chr(65 + $i))->setWidth($w);
            }

            $writer = new XlsxWriter($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            return response($content, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="echeancier_leasing.xlsx"',
                'Cache-Control'       => 'no-cache',
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    // ── Batch PDF export ──────────────────────────────────────────────
    public function exportPdf(Request $request)
    {
        $user = $request->user();
        $ids  = $request->input('ids', []);

        if (empty($ids)) {
            return response()->json(['message' => 'Aucun identifiant fourni.'], 422);
        }

        $query = EcheancierLeasing::with('client')->whereIn('id', $ids);
        if (!($user instanceof Administrateur)) {
            $query->where('client_id', $user->id);
        }
        $leasings = $query->get();

        if ($leasings->isEmpty()) {
            return response()->json(['message' => 'Aucun contrat trouvé.'], 404);
        }

        $statutLabels = [
            'actif'     => 'En cours',
            'solde'     => 'Soldé',
            'en_retard' => 'En retard',
            'a_venir'   => 'À venir',
        ];

        $heads  = [];
        $bodies = [];
        foreach ($leasings as $i => $leasing) {
            $html = $this->buildPdfHtml($leasing, $statutLabels);
            preg_match('/<style[^>]*>([\s\S]*?)<\/style>/i', $html, $styleMatch);
            preg_match('/<body[^>]*>([\s\S]*?)<\/body>/i', $html, $bodyMatch);
            if ($styleMatch) $heads[] = "<style>{$styleMatch[1]}</style>";
            $body = $bodyMatch[1] ?? '';
            if ($i < $leasings->count() - 1) {
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
        $safe = 'echeanciers_leasing_' . now()->format('Y-m-d');
        return $pdf->download("{$safe}.pdf");
    }

    // ── PDF HTML builder ──────────────────────────────────────────────
    private function buildPdfHtml(EcheancierLeasing $l, array $statutLabels): string
    {
        $color   = '#1565C0';
        $lightBg = '#EFF6FF';
        $statut  = $statutLabels[$l->statut] ?? $l->statut;
        $client  = $l->client;

        $dateDebut = $l->date_debut         ? $l->date_debut->format('d/m/Y')          : '—';
        $dateFin   = $l->date_fin           ? $l->date_fin->format('d/m/Y')            : '—';
        $prochain  = $l->prochaine_echeance ? $l->prochaine_echeance->format('d/m/Y')  : '—';
        $generated = now()->format('d/m/Y à H:i');
        $devise    = \App\Models\Parametre::currentDevise();

        $mensualite    = number_format($l->mensualite,       2, ',', ' ') . " {$devise}";
        $optionAchat   = $l->option_achat       ? number_format($l->option_achat,       2, ',', ' ') . " {$devise}" : '—';
        $valeurAchat   = $l->valeur_achat       ? number_format($l->valeur_achat,       2, ',', ' ') . " {$devise}" : '—';
        $capitalRestant= $l->capital_restant_du ? number_format($l->capital_restant_du, 2, ',', ' ') . " {$devise}" : '—';
        $taux          = $l->taux_interet       ? number_format($l->taux_interet,        2, ',', ' ') . ' %'  : '—';
        $tva           = $l->tva_loyers         ? number_format($l->tva_loyers,          2, ',', ' ') . " {$devise}" : '—';
        $totalLoyers   = $l->total_loyers       ? number_format($l->total_loyers,        2, ',', ' ') . " {$devise}" : '—';
        $nbMens        = $l->nombre_mensualites ? $l->nombre_mensualites . ' mensualité(s)' : '—';

        $statutBg = ['actif' => '#E8F5E9', 'solde' => '#E3F0FF', 'en_retard' => '#FFEBEE', 'a_venir' => '#FFF3E0'];
        $statutFg = ['actif' => '#2E7D32', 'solde' => '#1565C0', 'en_retard' => '#C62828', 'a_venir' => '#E65100'];
        $sBg = $statutBg[$l->statut] ?? '#F3F4F6';
        $sFg = $statutFg[$l->statut] ?? '#374151';

        $nom      = htmlspecialchars($client?->nom          ?? '—');
        $ent      = htmlspecialchars($client?->entreprise   ?? '—');
        $email    = htmlspecialchars($client?->email        ?? '—');
        $bien     = htmlspecialchars($l->bien               ?? '—');
        $descBien = htmlspecialchars($l->description_bien   ?? '—');
        $bailleur = htmlspecialchars($l->bailleur           ?? '—');
        $ref      = htmlspecialchars($l->contrat_ref);
        $notes    = htmlspecialchars($l->notes              ?? '');

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
    <div class="type-badge">LEASING</div>
    <div class="hdr-title">Contrat de Leasing</div>
    <div class="hdr-sub">Cr&eacute;dit-bail &mdash; Tableau d&apos;amortissement</div>
  </div>
  <div class="hdr-meta">
    <table><tr>
      <td>R&eacute;f&nbsp;: <strong><?= $ref ?></strong></td>
      <td class="sep">|</td>
      <td>Bailleur&nbsp;: <strong><?= $bailleur ?></strong></td>
      <td class="sep">|</td>
      <td>D&eacute;but&nbsp;: <strong><?= $dateDebut ?></strong></td>
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
      <tr class="r1"><td class="l">Bailleur (soci&eacute;t&eacute; de leasing)</td><td class="v"><?= $bailleur ?></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-head"><span class="sec-title">Bien Financ&eacute;</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Nature du bien</td><td class="v"><?= $bien ?></td></tr>
      <tr class="r1"><td class="l">Description</td><td class="v"><?= $descBien ?></td></tr>
      <tr class="r0"><td class="l">Valeur d&apos;achat</td><td class="v"><?= $valeurAchat ?></td></tr>
      <tr class="r1"><td class="l">Option d&apos;achat (rachat)</td><td class="v"><?= $optionAchat ?></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-head"><span class="sec-title">P&eacute;riode &amp; &Eacute;ch&eacute;ances</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Date de d&eacute;but</td><td class="v"><?= $dateDebut ?></td></tr>
      <tr class="r1"><td class="l">Date de fin</td><td class="v"><?= $dateFin ?></td></tr>
      <tr class="r0"><td class="l">Nombre de mensualit&eacute;s</td><td class="v"><?= $nbMens ?></td></tr>
      <tr class="r1"><td class="l">Prochaine &eacute;ch&eacute;ance</td><td class="v"><?= $prochain ?></td></tr>
      <tr class="r0"><td class="l">Statut du contrat</td><td class="v"><span class="stat"><?= htmlspecialchars($statut) ?></span></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-head"><span class="sec-title">Tableau Financier</span></div>
    <table class="itbl">
      <tr class="r0"><td class="l">Taux d&apos;int&eacute;r&ecirc;t annuel</td><td class="v"><?= $taux ?></td></tr>
      <tr class="r1"><td class="l">TVA sur loyers</td><td class="v"><?= $tva ?></td></tr>
      <tr class="r0"><td class="l">Capital restant d&ucirc;</td><td class="v"><?= $capitalRestant ?></td></tr>
    </table>
    <table class="ftbl">
      <tr class="fa"><td class="l">Mensualit&eacute; (loyer mensuel)</td><td class="r"><?= $mensualite ?></td></tr>
      <tr class="fdiv"><td colspan="2"></td></tr>
      <tr class="ftot"><td class="l">Total des loyers</td><td class="r"><?= $totalLoyers ?></td></tr>
    </table>
  </div>

<?php if ($l->notes): ?>
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
