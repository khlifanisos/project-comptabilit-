<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Client;
use App\Models\FactureAchat;
use App\Models\FactureVente;
use App\Models\ReleveBancaire;
use App\Models\DeclarationFiscale;
use App\Models\DeclarationSociale;
use App\Models\EcheancierLeasing;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        $user    = $request->user();
        $isAdmin = $user instanceof Administrateur;

        if ($isAdmin) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $clientQuery = Client::query();
            if ($adminEntreprise !== '') {
                $clientQuery->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]);
            }
            $clients = $clientQuery->get();
            $audits  = $clients->map(function ($client) {
                $audit           = $this->computeAudit($client->id);
                $audit['client'] = [
                    'id'         => $client->id,
                    'nom'        => $client->nom,
                    'email'      => $client->email,
                    'entreprise' => $client->entreprise,
                    'avatar'     => $client->avatar,
                ];
                return $audit;
            });
            return response()->json(['audits' => $audits]);
        }

        return response()->json($this->computeAudit($user->id));
    }

    private function computeAudit(int $clientId): array
    {
        $achats   = FactureAchat::where('client_id', $clientId)->get();
        $ventes   = FactureVente::where('client_id', $clientId)->get();
        $releves  = ReleveBancaire::where('client_id', $clientId)->orderBy('date')->get();
        $fiscales = DeclarationFiscale::where('client_id', $clientId)->get();
        $sociales = DeclarationSociale::where('client_id', $clientId)->get();
        $leasing  = EcheancierLeasing::where('client_id', $clientId)->get();

        $anomalies      = [];
        $verifications  = [];
        $recommandations = [];
        $missingTasks   = [];
        $score          = 100;

        // ── 1. Factures de vente en attente > 30 jours ───────────────
        $ventesEnRetard = $ventes->where('statut', 'en_attente')
            ->filter(fn($f) => Carbon::parse($f->date)->diffInDays(now()) > 30);
        if ($ventesEnRetard->count() > 0) {
            $n = $ventesEnRetard->count();
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => 'Factures de vente en attente',
                'detail' => "{$n} facture(s) de vente en attente depuis plus de 30 jours",
                'impact' => 'moyen',
                'lien'   => '/ventes',
            ];
            $score -= min(10, $n * 3);
        }

        // ── 2. Factures d'achat impayées > 60 jours ──────────────────
        $achatsEnRetard = $achats->filter(fn($f) =>
            in_array($f->statut ?? '', ['en_attente', 'non_payee']) &&
            Carbon::parse($f->date)->diffInDays(now()) > 60
        );
        if ($achatsEnRetard->count() > 0) {
            $n = $achatsEnRetard->count();
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => "Factures d'achat impayées",
                'detail' => "{$n} facture(s) d'achat non réglée(s) depuis plus de 60 jours",
                'impact' => 'moyen',
                'lien'   => '/achats',
            ];
            $score -= min(8, $n * 2);
        }

        // ── 3. Cohérence TVA : écart déclaré vs calculé ───────────────
        $tvaVentes   = $ventes->sum(fn($f) => (float)($f->montant_ttc ?? 0) - (float)($f->montant_ht ?? 0));
        $tvaAchats   = $achats->sum(fn($f) => (float)($f->montant_ttc ?? 0) - (float)($f->montant_ht ?? 0));
        $tvaNette    = $tvaVentes - $tvaAchats;
        $tvaFiscales = $fiscales->where('type', 'TVA');
        $tvaDeclaree = $tvaFiscales->sum('montant');
        $hasPendingTva = $tvaFiscales->filter(fn($d) => $d->statut !== 'validee')->isNotEmpty();

        if ($tvaDeclaree > 0 && $hasPendingTva && abs($tvaNette - $tvaDeclaree) > 100) {
            $ecart = number_format(abs($tvaNette - $tvaDeclaree), 2);
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => 'Écart TVA détecté',
                'detail' => "Écart de {$ecart} " . \App\Models\Parametre::currentDevise() . " entre TVA nette calculée et TVA déclarée",
                'impact' => 'élevé',
                'lien'   => '/fiscales',
            ];
            $score -= 15;
        }

        // ── 4. Déclarations fiscales dépassées ───────────────────────
        $fiscalesEchues = $fiscales->where('statut', 'a_declarer')
            ->filter(fn($d) => $d->date_limite && now()->gt(Carbon::parse($d->date_limite)));
        if ($fiscalesEchues->count() > 0) {
            $n = $fiscalesEchues->count();
            $anomalies[] = [
                'type'   => 'error',
                'titre'  => 'Déclarations fiscales en retard',
                'detail' => "{$n} déclaration(s) fiscale(s) dont la date limite est dépassée",
                'impact' => 'élevé',
                'lien'   => '/fiscales',
            ];
            $score -= min(30, $n * 10);
        }

        // ── 5. Déclarations fiscales imminentes (< 15 jours) ─────────
        $fiscalesImminentes = $fiscales->where('statut', 'a_declarer')
            ->filter(fn($d) => $d->date_limite &&
                now()->lte(Carbon::parse($d->date_limite)) &&
                now()->diffInDays(Carbon::parse($d->date_limite)) <= 15
            );
        if ($fiscalesImminentes->count() > 0) {
            $n = $fiscalesImminentes->count();
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => 'Déclarations fiscales imminentes',
                'detail' => "{$n} déclaration(s) fiscale(s) dont l'échéance est dans moins de 15 jours",
                'impact' => 'moyen',
                'lien'   => '/fiscales',
            ];
            $score -= 5;
        }

        // ── 6. Déclarations sociales dépassées ───────────────────────
        $socialesEchues = $sociales->where('statut', 'a_declarer')
            ->filter(fn($d) => $d->date_limite && now()->gt(Carbon::parse($d->date_limite)));
        if ($socialesEchues->count() > 0) {
            $n = $socialesEchues->count();
            $anomalies[] = [
                'type'   => 'error',
                'titre'  => 'Déclarations sociales en retard',
                'detail' => "{$n} déclaration(s) sociale(s) dont la date limite est dépassée",
                'impact' => 'élevé',
                'lien'   => '/sociales',
            ];
            $score -= min(24, $n * 8);
        }

        // ── 7. Cohérence solde bancaire ──────────────────────────────
        if ($releves->count() > 1) {
            $soldeActuel  = (float)($releves->last()->solde ?? 0);
            $totalCredits = $releves->where('type', 'credit')->sum('montant');
            $totalDebits  = $releves->where('type', 'debit')->sum('montant');
            $soldeCalcule = $totalCredits - $totalDebits;
            if (($totalCredits + $totalDebits) > 0 && abs($soldeActuel - $soldeCalcule) > 1000) {
                $anomalies[] = [
                    'type'   => 'warning',
                    'titre'  => 'Incohérence solde bancaire',
                    'detail' => 'Écart détecté entre le solde déclaré et le solde calculé depuis les relevés',
                    'impact' => 'moyen',
                    'lien'   => '/releves',
                ];
                $score -= 10;
            }
        }

        $leasingExpireSoon = collect();

        // ── 10. Rapprochement bancaire approximatif ───────────────────
        if ($releves->count() > 0) {
            $ventesValidees = $ventes->where('statut', 'validée');
            $unmatched = 0;
            foreach ($ventesValidees as $vente) {
                $month = Carbon::parse($vente->date)->format('Y-m');
                $hasMatch = $releves->where('type', 'credit')->filter(
                    fn($r) => Carbon::parse($r->date)->format('Y-m') === $month
                )->count() > 0;
                if (!$hasMatch) $unmatched++;
            }
            if ($unmatched > 0) {
                $anomalies[] = [
                    'type'   => 'warning',
                    'titre'  => 'Rapprochement bancaire incomplet',
                    'detail' => "{$unmatched} facture(s) de vente validée(s) sans crédit bancaire le même mois",
                    'impact' => 'moyen',
                    'lien'   => '/releves',
                ];
                $score -= min(10, $unmatched * 2);
            }
        }

        // ── Tâches manquantes ─────────────────────────────────────────
        if ($ventes->count() === 0)
            $missingTasks[] = "Aucune facture de vente enregistrée";
        if ($achats->count() === 0)
            $missingTasks[] = "Aucune facture d'achat enregistrée";
        if ($releves->count() === 0)
            $missingTasks[] = "Aucun relevé bancaire importé";
        if ($fiscales->count() === 0)
            $missingTasks[] = "Aucune déclaration fiscale renseignée";
        if ($sociales->count() === 0)
            $missingTasks[] = "Aucune déclaration sociale renseignée";

        // ── Vérifications ─────────────────────────────────────────────
        if ($ventes->count() > 0)
            $verifications[] = ['ok' => true,  'label' => 'Factures de vente',     'detail' => "{$ventes->count()} facture(s) enregistrée(s)"];
        if ($achats->count() > 0)
            $verifications[] = ['ok' => true,  'label' => "Factures d'achat",      'detail' => "{$achats->count()} facture(s) enregistrée(s)"];
        if ($releves->count() > 0)
            $verifications[] = ['ok' => true,  'label' => 'Relevés bancaires',     'detail' => "{$releves->count()} relevé(s) importé(s)"];
        if ($fiscales->count() > 0)
            $verifications[] = ['ok' => true,  'label' => 'Déclarations fiscales', 'detail' => "{$fiscales->count()} déclaration(s) enregistrée(s)"];
        if ($sociales->count() > 0)
            $verifications[] = ['ok' => true,  'label' => 'Déclarations sociales', 'detail' => "{$sociales->count()} déclaration(s) enregistrée(s)"];
        if ($leasing->count() > 0)
            $verifications[] = ['ok' => true,  'label' => 'Contrats leasing',      'detail' => "{$leasing->count()} contrat(s) enregistré(s)"];

        // ── Recommandations ───────────────────────────────────────────
        if ($achats->count() === 0 && $ventes->count() > 0)
            $recommandations[] = "Aucune facture d'achat enregistrée. Importez vos factures fournisseurs pour compléter votre comptabilité.";
        if ($releves->count() === 0)
            $recommandations[] = "Importez vos relevés bancaires pour un suivi de trésorerie complet et une meilleure détection d'anomalies.";
        if ($fiscales->where('statut', 'a_declarer')->count() > 0)
            $recommandations[] = "Des déclarations fiscales sont en attente. Anticipez leur traitement avant les dates limites.";
        if ($sociales->where('statut', 'a_declarer')->count() > 0)
            $recommandations[] = "Des déclarations sociales (CNSS, AMO, CIMR) sont à soumettre prochainement.";
        if ($ventes->count() > 0 && $ventes->where('statut', 'validée')->count() === 0)
            $recommandations[] = "Aucune facture de vente validée. Vérifiez le statut de vos factures après encaissement.";
        if ($leasingExpireSoon->count() > 0)
            $recommandations[] = "Des contrats leasing expirent dans 30 jours. Anticipez le renouvellement ou la clôture.";
        if (empty($recommandations))
            $recommandations[] = "Votre comptabilité est en bonne santé. Continuez à maintenir vos documents à jour régulièrement.";

        // ── Dernière activité ─────────────────────────────────────────
        $dates = array_filter([
            $ventes->count()  ? $ventes->max('updated_at')   : null,
            $achats->count()  ? $achats->max('updated_at')   : null,
            $releves->count() ? $releves->max('updated_at')  : null,
            $fiscales->count() ? $fiscales->max('updated_at') : null,
            $sociales->count() ? $sociales->max('updated_at') : null,
            $leasing->count() ? $leasing->max('updated_at')  : null,
        ]);
        $lastActivity = !empty($dates) ? max($dates) : null;

        $score = max(0, min(100, $score));

        if ($score >= 80)     $niveau = 'Excellent';
        elseif ($score >= 60) $niveau = 'Bon';
        elseif ($score >= 40) $niveau = 'Moyen';
        else                  $niveau = 'Critique';

        return [
            'score'           => $score,
            'niveau'          => $niveau,
            'anomalies'       => $anomalies,
            'verifications'   => $verifications,
            'recommandations' => $recommandations,
            'missing_tasks'   => $missingTasks,
            'last_activity'   => $lastActivity,
            'alerts_count'    => count(array_filter($anomalies, fn($a) => $a['type'] === 'error')),
            'stats'           => [
                'total_ventes'    => round($ventes->sum('montant_ttc'), 2),
                'total_achats'    => round($achats->sum('montant_ttc'), 2),
                'nb_factures'     => $ventes->count() + $achats->count(),
                'nb_declarations' => $fiscales->count() + $sociales->count(),
                'nb_releves'      => $releves->count(),
                'nb_leasing'      => $leasing->count(),
            ],
        ];
    }
}
