<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Client;
use App\Models\Contrat;
use App\Models\Parametre;
use App\Models\Reglement;
use App\Models\TicketFacture;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The cabinet's invoicing: one list for the invoices drawn up from validated
 * tickets and the préfactures generated from client contracts (one per
 * period: mensuelle, trimestrielle…), plus the payments imputed on them.
 *
 * Life of a contract invoice: préfacture "PF-26-000001" (en instance) →
 * validated into invoice "26-000001" (facturée) → réglée once the imputed
 * payments cover the net amount.
 */
class FacturationController extends Controller
{
    private const TIMBRE = 1.0;

    private function admin(Request $request): Administrateur
    {
        $user = $request->user();
        abort_unless($user instanceof Administrateur, 403, 'Accès refusé.');
        return $user;
    }

    private function superAdmin(Request $request): Administrateur
    {
        $admin = $this->admin($request);
        abort_unless($admin->is_super_admin, 403, 'Action réservée au super admin.');
        return $admin;
    }

    /** Super admin sees every invoice; an admin, those of their own tickets. */
    private function visibleFactures(Administrateur $admin): Builder
    {
        $query = TicketFacture::query();
        if (!$admin->is_super_admin) {
            $query->where(fn ($q) => $q->where('created_by', $admin->id)
                ->orWhereHas('ticket', fn ($t) => $t->where('assigned_to', $admin->id)->orWhere('created_by', $admin->id)));
        }
        return $query;
    }

    /** Same scope as the Clients page: an admin only sees their company's clients. */
    private function visibleClients(Administrateur $admin): Builder
    {
        $query = Client::where('is_approved', true);
        $entreprise = trim(strtolower($admin->entreprise ?? ''));
        if (!$admin->is_super_admin && $entreprise !== '') {
            $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$entreprise]);
        }
        return $query;
    }

    // ── Liste des factures ────────────────────────────────────────────────

    public function index(Request $request)
    {
        $admin = $this->admin($request);

        $query = $this->visibleFactures($admin)
            ->with(['client:id,nom,raison_sociale,matricule_fiscale', 'ticket:id,titre', 'contrat:id,type,designation', 'reglements'])
            ->orderByDesc('date_facture')->orderByDesc('id');

        if ($societe = $request->input('societe')) {
            $query->where('societe', $societe);
        }
        if ($clientId = $request->input('client_id')) {
            $query->where('client_id', $clientId);
        }
        if ($du = $request->input('du')) {
            $query->whereDate('date_facture', '>=', $du);
        }
        if ($au = $request->input('au')) {
            $query->whereDate('date_facture', '<=', $au);
        }
        match ($request->input('origine')) {
            'ticket'  => $query->whereNotNull('ticket_id'),
            'contrat' => $query->whereNotNull('contrat_id'),
            default   => null,
        };
        if ($q = trim((string) $request->input('q'))) {
            $query->where(fn ($w) => $w->where('numero', 'like', "%{$q}%")->orWhere('client_nom', 'like', "%{$q}%"));
        }

        $rows = $query->get()->map(fn (TicketFacture $f) => $this->serialize($f));

        // Statut is derived (préfacture / impayée / partielle / réglée), so it is filtered here.
        if ($statut = $request->input('statut')) {
            $rows = $rows->where('etat', $statut)->values();
        }

        $factures = $rows->where('prefacture', false);
        return response()->json([
            'factures' => $rows,
            'totaux'   => [
                'facture'      => round($factures->sum('net_facture'), 3),
                'regle'        => round($factures->sum('montant_regle'), 3),
                'reste'        => round($factures->sum('reste'), 3),
                'prefactures'  => round($rows->where('prefacture', true)->sum('net_facture'), 3),
                'nb_prefactures' => $rows->where('prefacture', true)->count(),
            ],
            'societes' => $this->visibleFactures($admin)->whereNotNull('societe')->where('societe', '!=', '')
                ->distinct()->orderBy('societe')->pluck('societe')
                ->merge(Contrat::whereNotNull('societe')->distinct()->pluck('societe'))
                ->unique()->sort()->values(),
        ]);
    }

    private function serialize(TicketFacture $f): array
    {
        $regle = round($f->reglements->sum('montant'), 3);
        $reste = round(max(0, $f->net_facture - $regle), 3);
        $prefacture = $f->isPrefacture();

        $etat = match (true) {
            $prefacture           => 'prefacture',
            $f->statut === 'en_instance' => 'en_instance',
            $reste <= 0.0005      => 'reglee',
            $regle > 0            => 'partielle',
            default               => 'impayee',
        };

        $origine = $f->ticket_id
            ? "Ticket #{$f->ticket_id}" . ($f->ticket ? " — {$f->ticket->titre}" : '')
            : ($f->contrat
                ? 'Contrat ' . $f->contrat->type . ($f->contrat->designation ? " — {$f->contrat->designation}" : '')
                : '—');

        return [
            'id'             => $f->id,
            'numero'         => $f->numero,
            'prefacture'     => $prefacture,
            'date_facture'   => $f->date_facture?->format('Y-m-d'),
            'client_id'      => $f->client_id,
            'client_nom'     => $f->client_nom,
            'matricule_fiscale' => $f->client?->matricule_fiscale,
            'societe'        => $f->societe,
            'origine'        => $f->ticket_id ? 'ticket' : ($f->contrat_id ? 'contrat' : 'autre'),
            'origine_label'  => $origine,
            'ticket_id'      => $f->ticket_id,
            'periode_debut'  => $f->periode_debut?->format('Y-m-d'),
            'periode_fin'    => $f->periode_fin?->format('Y-m-d'),
            'montant_ht'     => $f->montant_ht,
            'montant_tva'    => $f->montant_tva,
            'net_facture'    => $f->net_facture,
            'statut'         => $f->statut,
            'etat'           => $etat,
            'reglements'     => $f->reglements->map(fn (Reglement $r) => [
                'id' => $r->id, 'mode' => $r->mode, 'banque' => $r->banque, 'reference' => $r->reference,
                'montant' => $r->montant, 'date_reglement' => $r->date_reglement?->format('Y-m-d'),
                'observation' => $r->observation,
            ])->values(),
            'montant_regle'  => $regle,
            'reste'          => $prefacture ? $f->net_facture : $reste,
        ];
    }

    private function findFacture(Request $request, int $id): TicketFacture
    {
        return $this->visibleFactures($this->admin($request))->findOrFail($id);
    }

    /** Préfacture → invoice: takes the next real invoice number and becomes "facturée". */
    public function valider(Request $request, int $id)
    {
        $facture = $this->findFacture($request, $id);
        if (!$facture->isPrefacture() && $facture->statut !== 'en_instance') {
            return response()->json(['message' => 'Cette facture est déjà validée.'], 422);
        }

        DB::transaction(function () use ($facture) {
            $data = ['statut' => 'facture'];
            if ($facture->isPrefacture()) {
                $data['numero'] = TicketFacture::nextNumero();
            }
            $facture->update($data);
            $facture->ticket?->update(['facture' => true]);
        });

        return response()->json(['message' => "Facture {$facture->numero} validée.", 'facture' => $this->serialize($facture->fresh(['reglements', 'client', 'ticket', 'contrat']))]);
    }

    /** Only a préfacture can be deleted — a numbered invoice must be kept (or credited). */
    public function destroy(Request $request, int $id)
    {
        $this->superAdmin($request);
        $facture = $this->findFacture($request, $id);
        if (!$facture->isPrefacture()) {
            return response()->json(['message' => 'Une facture validée ne peut pas être supprimée.'], 422);
        }
        $facture->delete();
        return response()->json(['message' => 'Préfacture supprimée.']);
    }

    public function pdf(Request $request, int $id)
    {
        $facture = $this->findFacture($request, $id)->load('creator:id,nom,email,entreprise', 'ticket', 'client', 'contrat');

        $pdf = Pdf::loadView('pdf.ticket_facture', [
            'f'      => $facture,
            'ticket' => $facture->ticket,
            'client' => $facture->client,
            'devise' => Parametre::currentDevise(),
        ])->setPaper('a4', 'portrait');

        $type = $facture->isPrefacture() ? 'Prefacture' : 'Facture';
        return $pdf->download("{$type}_{$facture->numero}.pdf");
    }

    // ── Règlements ────────────────────────────────────────────────────────

    public function storeReglement(Request $request, int $id)
    {
        $admin = $this->admin($request);
        $facture = $this->findFacture($request, $id)->load('reglements');

        if ($facture->isPrefacture() || $facture->statut === 'en_instance') {
            return response()->json(['message' => "Validez d'abord la préfacture : un règlement s'impute sur une facture."], 422);
        }

        $reste = round($facture->net_facture - $facture->reglements->sum('montant'), 3);
        $validated = $request->validate([
            'mode'           => 'required|in:' . implode(',', Reglement::MODES),
            'banque'         => 'nullable|string|max:100|required_if:mode,cheque,virement,traite',
            'reference'      => 'nullable|string|max:100',
            'montant'        => 'required|numeric|min:0.001|max:' . max(0.001, $reste),
            'date_reglement' => 'required|date',
            'observation'    => 'nullable|string|max:255',
        ], [
            'montant.max'        => 'Le montant dépasse le reste à payer (' . number_format($reste, 3, ',', ' ') . ').',
            'banque.required_if' => 'La banque est obligatoire pour un chèque, un virement ou une traite.',
        ]);

        DB::transaction(function () use ($facture, $admin, $validated) {
            $facture->reglements()->create($validated + ['created_by' => $admin->id]);
            $this->syncStatut($facture);
        });

        return response()->json(['message' => 'Règlement imputé.', 'facture' => $this->serialize($facture->fresh(['reglements', 'client', 'ticket', 'contrat']))], 201);
    }

    public function destroyReglement(Request $request, int $id)
    {
        $reglement = Reglement::findOrFail($id);
        $facture = $this->findFacture($request, $reglement->facture_id);

        DB::transaction(function () use ($reglement, $facture) {
            $reglement->delete();
            $this->syncStatut($facture);
        });

        return response()->json(['message' => 'Règlement supprimé.', 'facture' => $this->serialize($facture->fresh(['reglements', 'client', 'ticket', 'contrat']))]);
    }

    /** Fully paid → "Rég. Client"; otherwise back to "Facturé". */
    private function syncStatut(TicketFacture $facture): void
    {
        $regle = (float) $facture->reglements()->sum('montant');
        $facture->update(['statut' => $regle >= $facture->net_facture - 0.0005 ? 'reg_client' : 'facture']);
    }

    // ── Préfactures des contrats ──────────────────────────────────────────

    /** Generates every préfacture due up to ?jusqu_au (default today) for the active contracts. */
    public function generer(Request $request)
    {
        $this->superAdmin($request);
        $jusquAu = Carbon::parse($request->input('jusqu_au', now()->toDateString()))->startOfDay();

        $query = Contrat::with('client')->where('actif', true);
        if ($request->filled('contrat_id')) {
            $query->where('id', $request->input('contrat_id'));
        }

        $crees = 0;
        foreach ($query->get() as $contrat) {
            $crees += $this->genererContrat($contrat, $jusquAu);
        }

        return response()->json([
            'message' => $crees ? "{$crees} préfacture(s) générée(s)." : 'Aucune nouvelle préfacture à générer.',
            'crees'   => $crees,
        ]);
    }

    /**
     * A period is billed the day after it ends: a monthly contract starting on
     * 01/04 gets its April préfacture dated 01/05. A last period cut short by
     * the contract end is billed pro rata temporis. A mission is billed once,
     * at its end date (or start date when open-ended).
     */
    private function genererContrat(Contrat $contrat, Carbon $jusquAu): int
    {
        $fin = $contrat->date_fin?->copy()->startOfDay();
        $periodes = [];

        if ($contrat->type === 'mission') {
            $date = $fin ?? $contrat->date_debut->copy();
            $periodes[] = [$contrat->date_debut->copy(), $fin ?? $contrat->date_debut->copy(), $date, 1.0];
        } else {
            $mois = Contrat::MOIS[$contrat->type];
            $debut = $contrat->date_debut->copy()->startOfDay();
            while ((!$fin || $debut->lte($fin)) && count($periodes) < 600) {
                $finPeriode = $debut->copy()->addMonthsNoOverflow($mois)->subDay();
                $ratio = 1.0;
                if ($fin && $fin->lt($finPeriode)) {
                    $ratio = ($debut->diffInDays($fin) + 1) / ($debut->diffInDays($finPeriode) + 1);
                    $finPeriode = $fin->copy();
                }
                $periodes[] = [$debut, $finPeriode, $finPeriode->copy()->addDay(), $ratio];
                $debut = $finPeriode->copy()->addDay();
            }
        }

        $existantes = $contrat->factures()->pluck('periode_debut')->map(fn ($d) => Carbon::parse($d)->toDateString())->all();
        $client = $contrat->client;
        $crees = 0;

        foreach ($periodes as [$debut, $finPeriode, $dateFacture, $ratio]) {
            if ($dateFacture->gt($jusquAu) || in_array($debut->toDateString(), $existantes, true)) {
                continue;
            }

            $libelle = 'Honoraires ' . Contrat::LIBELLES[$contrat->type]
                . ($contrat->designation ? " — {$contrat->designation}" : '')
                . ' — période du ' . $debut->format('d/m/Y') . ' au ' . $finPeriode->format('d/m/Y')
                . ($ratio < 1 ? ' (prorata ' . round($ratio * 100) . ' %)' : '');
            $lignes = [[
                'designation' => $libelle,
                'debours'     => false,
                'qt'          => 1,
                'pu_ht'       => round($contrat->montant_ht * $ratio, 3),
                'tva'         => $contrat->taux_tva,
                'remise'      => 0,
            ]];

            TicketFacture::create(TicketFactureController::computeTotals($lignes, 0, self::TIMBRE) + [
                'numero'          => TicketFacture::nextNumero(TicketFacture::PREFIXE_PREFACTURE),
                'client_id'       => $client->id,
                'contrat_id'      => $contrat->id,
                'periode_debut'   => $debut->toDateString(),
                'periode_fin'     => $finPeriode->toDateString(),
                'created_by'      => $contrat->created_by,
                'date_facture'    => $dateFacture->toDateString(),
                'societe'         => $contrat->societe,
                'client_nom'      => $client->raison_sociale ?: $client->nom,
                'observation'     => $contrat->designation ?: 'Honoraires ' . Contrat::LIBELLES[$contrat->type],
                'exercice'        => $debut->format('Y'),
                'statut'          => 'en_instance',
                'lignes'          => $lignes,
                'remise_acc_taux' => 0,
                'timbre'          => self::TIMBRE,
            ]);
            $crees++;
        }

        return $crees;
    }

    // ── Fiche client ──────────────────────────────────────────────────────

    public function clients(Request $request)
    {
        $admin = $this->admin($request);

        $clients = $this->visibleClients($admin)->orderBy('nom')
            ->get(['id', 'nom', 'email', 'raison_sociale', 'matricule_fiscale', 'gerant', 'contact', 'telephone', 'adresse']);

        $contrats = Contrat::whereIn('client_id', $clients->pluck('id'))->orderByDesc('date_debut')->get()->groupBy('client_id');

        // Outstanding balance per client: validated invoices minus imputed payments.
        $soldes = DB::table('ticket_factures as f')
            ->leftJoinSub(DB::table('reglements')->selectRaw('facture_id, SUM(montant) as regle')->groupBy('facture_id'), 'r', 'r.facture_id', '=', 'f.id')
            ->whereIn('f.client_id', $clients->pluck('id'))
            ->where('f.numero', 'not like', TicketFacture::PREFIXE_PREFACTURE . '%')
            ->where('f.statut', '!=', 'en_instance')
            ->groupBy('f.client_id')
            ->selectRaw('f.client_id, SUM(f.net_facture) as facture, SUM(COALESCE(r.regle, 0)) as regle')
            ->get()->keyBy('client_id');

        return response()->json($clients->map(fn (Client $c) => $c->toArray() + [
            'contrats' => $contrats->get($c->id, collect())->values(),
            'total_facture' => round((float) ($soldes[$c->id]->facture ?? 0), 3),
            'solde'         => round((float) (($soldes[$c->id]->facture ?? 0) - ($soldes[$c->id]->regle ?? 0)), 3),
        ]));
    }

    public function updateFiche(Request $request, int $id)
    {
        $admin = $this->admin($request);
        $client = $this->visibleClients($admin)->findOrFail($id);

        $client->update($request->validate([
            'raison_sociale'    => 'nullable|string|max:150',
            'matricule_fiscale' => ['nullable', 'string', 'max:50'],
            'gerant'            => 'nullable|string|max:150',
            'contact'           => 'nullable|string|max:255',
            'telephone'         => 'nullable|string|max:20',
            'adresse'           => 'nullable|string|max:500',
        ]));

        return response()->json(['message' => 'Fiche client enregistrée.', 'client' => $client->fresh()]);
    }

    // ── Contrats ──────────────────────────────────────────────────────────

    private function contratRules(): array
    {
        return [
            'client_id'   => 'required|integer|exists:clients,id',
            'societe'     => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'type'        => 'required|in:mensuelle,trimestrielle,semestrielle,annuelle,mission',
            'montant_ht'  => 'required|numeric|min:0',
            'taux_tva'    => 'required|in:0,7,13,19',
            'date_debut'  => 'required|date',
            'date_fin'    => 'nullable|date|after_or_equal:date_debut',
            'actif'       => 'boolean',
        ];
    }

    public function storeContrat(Request $request)
    {
        $admin = $this->superAdmin($request);
        $contrat = Contrat::create($request->validate($this->contratRules()) + ['created_by' => $admin->id]);
        return response()->json(['message' => 'Contrat enregistré.', 'contrat' => $contrat], 201);
    }

    public function updateContrat(Request $request, int $id)
    {
        $this->superAdmin($request);
        $contrat = Contrat::findOrFail($id);
        $contrat->update($request->validate($this->contratRules()));
        return response()->json(['message' => 'Contrat mis à jour.', 'contrat' => $contrat->fresh()]);
    }

    /** A contract that already produced real invoices is closed (inactive), not deleted. */
    public function destroyContrat(Request $request, int $id)
    {
        $this->superAdmin($request);
        $contrat = Contrat::findOrFail($id);

        $facturees = $contrat->factures()->where('numero', 'not like', TicketFacture::PREFIXE_PREFACTURE . '%')->exists();
        if ($facturees) {
            $contrat->update(['actif' => false]);
            return response()->json(['message' => 'Ce contrat a déjà des factures : il a été désactivé au lieu d\'être supprimé.']);
        }

        DB::transaction(function () use ($contrat) {
            $contrat->factures()->delete();
            $contrat->delete();
        });
        return response()->json(['message' => 'Contrat supprimé.']);
    }
}
