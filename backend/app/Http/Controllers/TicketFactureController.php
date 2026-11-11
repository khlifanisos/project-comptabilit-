<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Parametre;
use App\Models\Ticket;
use App\Models\TicketFacture;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "Bon d'intervention" invoicing for validated tickets: once the super admin
 * validates a ticket, its creator/assignee fills the invoice form (lines,
 * TVA, remise, timbre) and downloads it as a PDF.
 */
class TicketFactureController extends Controller
{
    /** Single TVA rate applied to every honoraire line (débours are hors TVA). */
    public const TAUX_TVA = 19;

    /** Retenue à la source on honoraires, in %. */
    public const TAUX_RETENUE = 3;

    private function canAccess(Administrateur $admin, Ticket $ticket): bool
    {
        return $admin->is_super_admin || $ticket->created_by === $admin->id || $ticket->assigned_to === $admin->id;
    }


    /** Returns the saved invoice, or a blank form — the admin fills everything by hand; only the numero is assigned. */
    public function show(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::with('client', 'facturation')->findOrFail($id);

        if (!$this->canAccess($admin, $ticket)) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }
        if ($ticket->statut !== 'valide') {
            return response()->json(['message' => 'Le ticket doit être validé avant la facturation.'], 422);
        }

        // Identifiant unique of the ticket's client, from its fiche client (shown, not stored on the invoice).
        $clientIu = $ticket->client?->matricule_fiscale;

        if ($ticket->facturation) {
            return response()->json([
                'facture'   => $ticket->facturation,
                'existe'    => true,
                'client_iu' => $clientIu,
                // Payments already imputed (Facturation › Imputer un règlement), for the "Réglé / Reste" display.
                'regle'     => round((float) $ticket->facturation->reglements()->sum('montant'), 3),
            ]);
        }

        return response()->json([
            'existe'  => false,
            'client_iu' => $clientIu,
            'regle'   => 0,
            'facture' => [
                'numero'          => TicketFacture::nextNumero(),
                'date_facture'    => '',
                'societe'         => '',
                'client_code'     => '',
                'client_nom'      => '',
                'observation'     => '',
                'exercice'        => '',
                'statut'          => 'en_instance',
                'mode_paiement'   => '',
                'duplicata'       => false,
                'tampon'          => false,
                'sans_en_tete'    => false,
                'lignes'          => [[
                    'designation' => '',
                    'debours'     => false,
                    'qt'          => 0,
                    'pu_ht'       => 0,
                    'tva'         => self::TAUX_TVA,
                    'remise'      => 0,
                ]],
                'remise_acc_taux' => 0,
                'timbre'          => 0,
                'retenue_source'  => false,
            ],
        ]);
    }

    /** Creates or updates the ticket's invoice; totals are always recomputed here. */
    public function save(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::with('facturation')->findOrFail($id);

        if (!$this->canAccess($admin, $ticket)) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }
        if ($ticket->statut !== 'valide') {
            return response()->json(['message' => 'Le ticket doit être validé avant la facturation.'], 422);
        }

        $validated = $request->validate([
            'date_facture'          => 'required|date',
            'societe'               => 'nullable|string|max:255',
            'client_code'           => 'nullable|string|max:50',
            'client_nom'            => 'required|string|max:255',
            'observation'           => 'nullable|string|max:500',
            'exercice'              => 'nullable|string|max:10',
            'statut'                => 'required|in:en_instance,facture,reg_client',
            'mode_paiement'         => 'nullable|string|max:100',
            'duplicata'             => 'boolean',
            'tampon'                => 'boolean',
            'sans_en_tete'          => 'boolean',
            'lignes'                => 'required|array|min:1|max:200',
            'lignes.*.designation'  => 'required|string|max:500',
            'lignes.*.debours'      => 'boolean',
            'lignes.*.qt'           => 'required|numeric|min:0',
            'lignes.*.pu_ht'        => 'required|numeric|min:0',
            'lignes.*.remise'       => 'nullable|numeric|min:0|max:100',
            'remise_acc_taux'       => 'nullable|numeric|min:0|max:100',
            'timbre'                => 'nullable|numeric|min:0',
            'retenue_source'        => 'boolean',
        ]);

        $lignes = array_map(fn ($l) => [
            'designation' => trim($l['designation']),
            'debours'     => (bool) ($l['debours'] ?? false),
            'qt'          => (float) $l['qt'],
            'pu_ht'       => (float) $l['pu_ht'],
            'tva'         => ($l['debours'] ?? false) ? 0 : self::TAUX_TVA,
            'remise'      => (float) ($l['remise'] ?? 0),
        ], $validated['lignes']);

        $totaux = self::computeTotals($lignes, (float) ($validated['remise_acc_taux'] ?? 0), (float) ($validated['timbre'] ?? 1), (bool) ($validated['retenue_source'] ?? false));

        $data = array_merge($validated, $totaux, [
            'lignes'          => $lignes,
            'remise_acc_taux' => (float) ($validated['remise_acc_taux'] ?? 0),
            'timbre'          => (float) ($validated['timbre'] ?? 1),
        ]);

        $facture = DB::transaction(function () use ($ticket, $admin, $data) {
            if ($ticket->facturation) {
                $ticket->facturation->update($data);
                $facture = $ticket->facturation;
            } else {
                $facture = TicketFacture::create($data + [
                    'ticket_id'  => $ticket->id,
                    'client_id'  => $ticket->client_id,
                    'created_by' => $admin->id,
                    'numero'     => TicketFacture::nextNumero(),
                ]);
            }
            // "En instance" is still a draft; anything further counts as billed.
            $ticket->update(['facture' => $data['statut'] !== 'en_instance']);
            return $facture;
        });

        return response()->json([
            'message' => 'Facture ' . $facture->numero . ' enregistrée.',
            'facture' => $facture->fresh(),
        ]);
    }

    public function pdf(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::with('facturation', 'client')->findOrFail($id);

        if (!$this->canAccess($admin, $ticket)) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }
        if (!$ticket->facturation) {
            return response()->json(['message' => "Aucune facture n'a encore été enregistrée pour ce ticket."], 404);
        }

        $facture = $ticket->facturation->load('creator:id,nom,email,entreprise');
        $pdf = Pdf::loadView('pdf.ticket_facture', [
            'f'      => $facture,
            'ticket' => $ticket,
            'client' => $ticket->client,
            'devise' => Parametre::currentDevise(),
        ])->setPaper('a4', 'portrait');

        return $pdf->download("Facture_{$facture->numero}.pdf");
    }

    /**
     * With $retenue, the client withholds TAUX_RETENUE % of the honoraires TTC
     * (HT + TVA; débours and timbre are not honoraires): the invoice keeps its
     * TTC and the net to pay becomes TTC − retenue.
     *
     * Line total = QT × PU HT − line remise %. Débours lines are re-billed at
     * cost: no TVA, no accumulated remise, added straight to the TTC. Every
     * other line is taxed at the single TAUX_TVA rate, whatever rate it was
     * saved with. The "Remise Acc." % applies to the taxable total.
     * TTC = HT + TVA + Débours + Timbre.
     */
    public static function computeTotals(array $lignes, float $remiseAccTaux, float $timbre, bool $retenue = false): array
    {
        $bases   = [(string) self::TAUX_TVA => 0.0];
        $debours = 0.0;

        foreach ($lignes as $l) {
            $net = $l['qt'] * $l['pu_ht'] * (1 - ($l['remise'] ?? 0) / 100);
            if ($l['debours']) {
                $debours += $net;
            } else {
                $bases[(string) self::TAUX_TVA] += $net;
            }
        }

        $brut      = array_sum($bases);
        $remiseAcc = $brut * $remiseAccTaux / 100;
        $ht        = $brut - $remiseAcc;

        $tva = 0.0;
        foreach ($bases as $taux => $base) {
            $bases[$taux] = round($base * (1 - $remiseAccTaux / 100), 3);
            $tva += $bases[$taux] * ((int) $taux) / 100;
        }

        $ttc = $ht + round($tva, 3) + $debours + $timbre;
        $montantRetenue = $retenue ? round(($ht + round($tva, 3)) * self::TAUX_RETENUE / 100, 3) : 0.0;

        return [
            'montant_brut'    => round($brut, 3),
            'remise_acc'      => round($remiseAcc, 3),
            'montant_debours' => round($debours, 3),
            'montant_ht'      => round($ht, 3),
            'montant_tva'     => round($tva, 3),
            'montant_ttc'     => round($ttc, 3),
            'montant_retenue' => $montantRetenue,
            'net_facture'     => round($ttc - $montantRetenue, 3),
            'bases_tva'       => $bases,
        ];
    }
}
