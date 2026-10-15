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
    /** Tunisian TVA rates offered on each line. */
    private const TAUX_TVA = [0, 7, 13, 19];

    private function canAccess(Administrateur $admin, Ticket $ticket): bool
    {
        return $admin->is_super_admin || $ticket->created_by === $admin->id || $ticket->assigned_to === $admin->id;
    }

    /** Next "YY-000001" number, sequenced per calendar year. */
    private function nextNumero(): string
    {
        $prefix = now()->format('y') . '-';
        $last = TicketFacture::where('numero', 'like', $prefix . '%')->orderByDesc('numero')->value('numero');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
    }

    /** Returns the saved invoice, or a pre-filled draft built from the ticket. */
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

        if ($ticket->facturation) {
            return response()->json(['facture' => $ticket->facturation, 'existe' => true]);
        }

        $client = $ticket->client;
        return response()->json([
            'existe'  => false,
            'facture' => [
                'numero'          => $this->nextNumero(),
                'date_facture'    => now()->toDateString(),
                'societe'         => $admin->entreprise ?: $admin->nom,
                'client_code'     => $client ? str_pad((string) $client->id, 6, '0', STR_PAD_LEFT) : '',
                'client_nom'      => $client ? ($client->entreprise ?: $client->nom) : '',
                'observation'     => $ticket->titre,
                'exercice'        => (string) now()->year,
                'statut'          => 'en_instance',
                'mode_paiement'   => '',
                'duplicata'       => false,
                'tampon'          => false,
                'sans_en_tete'    => false,
                'lignes'          => [[
                    'designation' => $ticket->titre,
                    'debours'     => false,
                    'qt'          => 1,
                    'pu_ht'       => 0,
                    'tva'         => 19,
                    'remise'      => 0,
                ]],
                'remise_acc_taux' => 0,
                'timbre'          => 1,
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
            'lignes.*.tva'          => 'required|in:' . implode(',', self::TAUX_TVA),
            'lignes.*.remise'       => 'nullable|numeric|min:0|max:100',
            'remise_acc_taux'       => 'nullable|numeric|min:0|max:100',
            'timbre'                => 'nullable|numeric|min:0',
        ]);

        $lignes = array_map(fn ($l) => [
            'designation' => trim($l['designation']),
            'debours'     => (bool) ($l['debours'] ?? false),
            'qt'          => (float) $l['qt'],
            'pu_ht'       => (float) $l['pu_ht'],
            'tva'         => (int) $l['tva'],
            'remise'      => (float) ($l['remise'] ?? 0),
        ], $validated['lignes']);

        $totaux = self::computeTotals($lignes, (float) ($validated['remise_acc_taux'] ?? 0), (float) ($validated['timbre'] ?? 1));

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
                    'created_by' => $admin->id,
                    'numero'     => $this->nextNumero(),
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

        $facture = $ticket->facturation;
        $pdf = Pdf::loadView('pdf.ticket_facture', [
            'f'      => $facture,
            'ticket' => $ticket,
            'client' => $ticket->client,
            'devise' => Parametre::currentDevise(),
        ])->setPaper('a4', 'portrait');

        return $pdf->download("Facture_{$facture->numero}.pdf");
    }

    /**
     * Line total = QT × PU HT − line remise %. Débours lines are re-billed at
     * cost: no TVA, no accumulated remise, added straight to the TTC. The
     * "Remise Acc." % applies to the taxable total and is spread pro-rata over
     * each TVA base. TTC = HT + TVA + Débours + Timbre.
     */
    public static function computeTotals(array $lignes, float $remiseAccTaux, float $timbre): array
    {
        $bases   = array_fill_keys(array_map('strval', self::TAUX_TVA), 0.0);
        $debours = 0.0;

        foreach ($lignes as $l) {
            $net = $l['qt'] * $l['pu_ht'] * (1 - ($l['remise'] ?? 0) / 100);
            if ($l['debours']) {
                $debours += $net;
            } else {
                $bases[(string) $l['tva']] += $net;
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

        return [
            'montant_brut'    => round($brut, 3),
            'remise_acc'      => round($remiseAcc, 3),
            'montant_debours' => round($debours, 3),
            'montant_ht'      => round($ht, 3),
            'montant_tva'     => round($tva, 3),
            'montant_ttc'     => round($ttc, 3),
            'net_facture'     => round($ttc, 3),
            'bases_tva'       => $bases,
        ];
    }
}
