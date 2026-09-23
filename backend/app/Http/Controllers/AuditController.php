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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class AuditController extends Controller
{
    private const AI_MODELS = [
        ['model' => 'gemini-2.5-flash',      'api' => 'v1beta'],
        ['model' => 'gemini-3.5-flash-lite', 'api' => 'v1beta'],
    ];

    /**
     * Copilote IA de l'audit — génère une synthèse en langage naturel et des
     * actions prioritaires à partir des anomalies déjà calculées par les
     * règles déterministes de computeAudit(). Appelé UNIQUEMENT à la demande
     * (bouton "Générer" côté front, jamais dans le polling automatique) et
     * mis en cache 15 minutes par client pour limiter la consommation du
     * quota Gemini.
     */
    public function aiSummary(Request $request)
    {
        $user = $request->user();
        $clientId = $user instanceof Administrateur
            ? (int) $request->query('client_id', 0)
            : $user->id;

        if (!$clientId) {
            return response()->json(['message' => 'client_id requis.'], 422);
        }
        if ($user instanceof Administrateur) {
            $client = Client::find($clientId);
            if (!$client) return response()->json(['message' => 'Client introuvable.'], 404);
        }

        $cacheKey = "audit_ai_summary_{$clientId}";
        if ($request->query('force') !== '1' && Cache::has($cacheKey)) {
            return response()->json(Cache::get($cacheKey) + ['cached' => true]);
        }

        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json(['message' => 'Analyse IA indisponible (clé API non configurée).'], 500);
        }

        $audit = $this->computeAudit($clientId);

        $context = json_encode([
            'score'           => $audit['score'],
            'niveau'          => $audit['niveau'],
            'anomalies'       => array_map(fn($a) => ['titre' => $a['titre'], 'detail' => $a['detail'], 'impact' => $a['impact']], $audit['anomalies']),
            'taches_manquantes' => $audit['missing_tasks'],
            'stats'           => $audit['stats'],
        ], JSON_UNESCAPED_UNICODE);

        $prompt = "Tu es un expert-comptable tunisien qui conseille un client sur l'état de sa comptabilité. "
            . "Voici le résultat d'un audit automatique (JSON) : {$context}\n\n"
            . "Réponds UNIQUEMENT avec un objet JSON valide (aucun texte hors JSON, aucun markdown) au format :\n"
            . '{"synthese": "un paragraphe de 2-3 phrases résumant la situation, ton professionnel et direct, en français", '
            . '"actions_prioritaires": ["action concrète 1", "action concrète 2", "action concrète 3"]}' . "\n\n"
            . "Les actions doivent être classées par priorité décroissante, concrètes et actionnables (pas de généralités). "
            . "Si aucune anomalie n'est présente, félicite brièvement et propose une action de suivi préventif.";

        $rateLimited = false;

        foreach (self::AI_MODELS as ['model' => $model, 'api' => $api]) {
            $url = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";
            $response = Http::withoutVerifying()->timeout(30)->post($url, [
                'contents'         => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 4096, 'responseMimeType' => 'application/json'],
            ]);

            if (!$response->successful()) {
                if ($response->status() === 429) $rateLimited = true;
                \Illuminate\Support\Facades\Log::warning('AuditController::aiSummary — échec modèle', [
                    'model' => $model, 'status' => $response->status(),
                    'body'  => mb_substr($response->body(), 0, 300),
                ]);
                continue;
            }
            $text = $response->json('candidates.0.content.parts.0.text') ?? '';
            if (!$text) {
                \Illuminate\Support\Facades\Log::warning('AuditController::aiSummary — réponse vide', [
                    'model' => $model, 'finishReason' => $response->json('candidates.0.finishReason'),
                ]);
                continue;
            }

            $data = json_decode(trim($text), true);
            if (!$data) {
                $clean = preg_replace('/```json\s*/i', '', $text);
                $clean = preg_replace('/```/', '', $clean);
                $data  = json_decode(trim($clean), true);
            }
            if (!$data || empty($data['synthese'])) {
                \Illuminate\Support\Facades\Log::warning('AuditController::aiSummary — JSON invalide', [
                    'model' => $model, 'text' => mb_substr($text, 0, 300),
                ]);
                continue;
            }

            $result = [
                'synthese'             => (string) $data['synthese'],
                'actions_prioritaires' => array_values(array_filter(array_map('strval', (array) ($data['actions_prioritaires'] ?? [])))),
                'generated_at'         => now()->toIso8601String(),
            ];
            Cache::put($cacheKey, $result, now()->addMinutes(15));
            return response()->json($result + ['cached' => false]);
        }

        $message = $rateLimited
            ? "Quota IA temporairement atteint — réessayez dans une minute."
            : "Impossible de générer l'analyse IA pour le moment.";
        return response()->json(['message' => $message], 502);
    }

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

    /**
     * Estimation du coût réel d'un retard de déclaration selon le Code des
     * Droits et Procédures Fiscaux tunisien (CDPF) :
     *   - Pénalité de retard : 1,25 % du montant exigible par mois ou fraction
     *     de mois de retard (taux en vigueur depuis la LF 2023).
     *   - Majoration fixe : 1,25 % si le retard ne dépasse pas 60 jours,
     *     2,5 % au-delà.
     *   - Minimum de perception : 5 (unité monétaire), dû même à défaut de
     *     montant exigible.
     * Ce n'est qu'une estimation pédagogique pour alerter le client — elle ne
     * remplace pas un calcul officiel de l'administration fiscale.
     */
    private function estimateCdpfPenalty(float $montant, int $joursRetard): float
    {
        if ($joursRetard <= 0) return 0.0;

        $moisRetard      = max(1, (int) ceil($joursRetard / 30));
        $penaliteMensuelle = $montant * 0.0125 * $moisRetard;
        $tauxMajoration    = $joursRetard <= 60 ? 0.0125 : 0.025;
        $majorationFixe    = $montant * $tauxMajoration;

        return round(max($penaliteMensuelle + $majorationFixe, 5), 2);
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
        $coutPenalitesFiscales = 0.0;
        if ($fiscalesEchues->count() > 0) {
            $n = $fiscalesEchues->count();
            $coutPenalitesFiscales = $fiscalesEchues->sum(fn($d) =>
                $this->estimateCdpfPenalty((float) ($d->montant ?? 0), now()->diffInDays(Carbon::parse($d->date_limite)))
            );
            $devise = \App\Models\Parametre::currentDevise();
            $anomalies[] = [
                'type'   => 'error',
                'titre'  => 'Déclarations fiscales en retard',
                'detail' => "{$n} déclaration(s) fiscale(s) dont la date limite est dépassée"
                    . ($coutPenalitesFiscales > 0 ? " — pénalité CDPF estimée : " . number_format($coutPenalitesFiscales, 2) . " {$devise}" : ''),
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
        $coutPenalitesSociales = 0.0;
        if ($socialesEchues->count() > 0) {
            $n = $socialesEchues->count();
            $coutPenalitesSociales = $socialesEchues->sum(fn($d) =>
                $this->estimateCdpfPenalty((float) ($d->montant ?? 0), now()->diffInDays(Carbon::parse($d->date_limite)))
            );
            $devise = \App\Models\Parametre::currentDevise();
            $anomalies[] = [
                'type'   => 'error',
                'titre'  => 'Déclarations sociales en retard',
                'detail' => "{$n} déclaration(s) sociale(s) dont la date limite est dépassée"
                    . ($coutPenalitesSociales > 0 ? " — pénalité CDPF estimée : " . number_format($coutPenalitesSociales, 2) . " {$devise}" : ''),
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

        // ── 8. Doublons potentiels de factures ────────────────────────
        // Deux factures du même client, même montant, même jour : signe
        // fréquent d'une double saisie (le numéro seul ne suffit pas à le
        // détecter car il est unique en base par construction).
        $detectDuplicates = function ($factures) {
            return $factures
                ->groupBy(fn($f) => Carbon::parse($f->date)->format('Y-m-d') . '|' . number_format((float) ($f->montant_ttc ?? 0), 2, '.', ''))
                ->filter(fn($group) => $group->count() > 1);
        };
        $doublonsVentes = $detectDuplicates($ventes);
        $doublonsAchats = $detectDuplicates($achats);
        if ($doublonsVentes->count() > 0) {
            $n = $doublonsVentes->sum(fn($g) => $g->count());
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => 'Doublons possibles — factures de vente',
                'detail' => "{$n} facture(s) de vente avec le même montant et la même date, à vérifier (double saisie possible)",
                'impact' => 'moyen',
                'lien'   => '/ventes',
            ];
            $score -= min(6, $doublonsVentes->count() * 3);
        }
        if ($doublonsAchats->count() > 0) {
            $n = $doublonsAchats->sum(fn($g) => $g->count());
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => "Doublons possibles — factures d'achat",
                'detail' => "{$n} facture(s) d'achat avec le même montant et la même date, à vérifier (double saisie possible)",
                'impact' => 'moyen',
                'lien'   => '/achats',
            ];
            $score -= min(6, $doublonsAchats->count() * 3);
        }

        // ── 9. Conformité facturation électronique (El Fatoora / TEIF) ─
        // Obligatoire en Tunisie pour toutes les factures de vente datées à
        // partir du 1er janvier 2026 (LF 2026, art. 53 — étendue aux services).
        $seuilFacturationElectronique = Carbon::create(2026, 1, 1);
        $ventesNonConformes = $ventes->filter(fn($f) =>
            Carbon::parse($f->date)->gte($seuilFacturationElectronique) &&
            !$f->facture_electronique
        );
        if ($ventesNonConformes->count() > 0) {
            $n = $ventesNonConformes->count();
            $anomalies[] = [
                'type'   => 'warning',
                'titre'  => 'Facturation électronique non renseignée',
                'detail' => "{$n} facture(s) de vente depuis le 1er janvier 2026 sans statut de conformité El Fatoora/TEIF — obligatoire selon la LF 2026",
                'impact' => 'moyen',
                'lien'   => '/ventes',
            ];
            $score -= min(12, $n * 2);
        }

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
                'cout_penalites_estime' => round($coutPenalitesFiscales + $coutPenalitesSociales, 2),
            ],
        ];
    }
}
