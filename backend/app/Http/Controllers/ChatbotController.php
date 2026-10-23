<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Assistant comptable (widget chatbot). L'appel Gemini se fait ici pour que la
 * clé API reste côté serveur — elle ne doit jamais être exposée au navigateur.
 */
class ChatbotController extends Controller
{
    private const AI_MODELS = [
        ['model' => 'gemini-2.5-flash',      'api' => 'v1beta'],
        ['model' => 'gemini-3.5-flash-lite', 'api' => 'v1beta'],
    ];

    private const TICKET_STATUTS = [
        'a_faire'               => 'À faire',
        'en_cours'              => 'En cours',
        'en_attente_validation' => 'En attente de validation',
        'valide'                => 'Validé',
        'rejete'                => 'Rejeté',
    ];

    private const FACTURE_STATUTS = [
        'en_instance' => 'En instance',
        'facture'     => 'Facturé',
        'reg_client'  => 'Réglé par le client',
    ];

    // Garde-fou sur la taille du contexte envoyé par le front (factures, relevés…).
    private const MAX_CONTEXT_CHARS = 60000;

    // Derniers échanges de la conversation, pour que l'assistant comprenne les questions de suivi.
    private const HISTORY_RULES = [
        'history'        => 'nullable|array|max:10',
        'history.*.role' => 'required|in:user,assistant',
        'history.*.text' => 'required|string|max:4000',
    ];

    // Le widget affiche du Markdown simple : gras, listes, titres courts.
    private const STYLE_RULES = "Réponds TOUJOURS en français, de façon claire, concise et bien structurée. "
        . "Utilise du Markdown simple (**gras**, listes à puces ou numérotées, titres ### courts) ; pas de tableaux ni de liens. "
        . "Va droit au but : commence par la réponse, puis les détails utiles. ";

    /** Utilisateur connecté : réponse basée sur ses données comptables + tickets (admins). */
    public function ask(Request $request)
    {
        $validated = $request->validate([
            'question' => 'required|string|max:1000',
            'devise'   => 'nullable|string|max:10',
            'context'  => 'nullable|array',
        ] + self::HISTORY_RULES);

        $devise  = $validated['devise'] ?? 'TND';
        $context = $validated['context'] ?? [];
        $user    = $request->user();

        $contextJson = json_encode($context, JSON_UNESCAPED_UNICODE) ?: '{}';
        if (mb_strlen($contextJson) > self::MAX_CONTEXT_CHARS) {
            $contextJson = mb_substr($contextJson, 0, self::MAX_CONTEXT_CHARS) . '…(tronqué)';
        }

        $prompt = "Tu es un assistant comptable et financier intelligent. " . self::STYLE_RULES
            . "Ne cite jamais les noms techniques des champs JSON (ex. marque_facture, facture_emise) : utilise des termes métier.\n\n"
            . "Devise : {$devise}\n"
            . "Données comptables de l'entreprise (JSON) : {$contextJson}\n";

        if ($user instanceof Administrateur) {
            $tickets = $this->ticketsFor($user);
            $prompt .= "Tickets / tâches de l'équipe (" . count($tickets) . ") : " . json_encode($tickets, JSON_UNESCAPED_UNICODE) . "\n\n"
                . "À propos des tickets : \"assigne_a\" est le collaborateur chargé de la tâche. \"marque_facture\" est le badge "
                . "\"Facturée / Non facturée\" affiché dans la liste des tickets. \"facture_emise\" est la facture réellement créée pour le "
                . "ticket (null = aucune facture), avec son statut (En instance = brouillon pas encore facturé, Facturé, Réglé par le client). "
                . "Quand on demande si un ticket est facturé, donne les deux informations et signale clairement toute incohérence "
                . "(ex. facture créée alors que le badge indique \"Non facturée\"). Le titre d'un ticket peut mentionner une facture "
                . "(ex. \"Classer les factures d'achat\") sans que le ticket soit lui-même facturé. Quand on te demande des informations "
                . "sur une personne, cherche-la aussi dans les tickets (assigne_a, client) et pas seulement dans les factures.\n";
        }

        return $this->reply($prompt, $validated['history'] ?? [], $validated['question']);
    }

    /** Page d'accueil publique : aucune donnée privée, questions générales uniquement. */
    public function askPublic(Request $request)
    {
        $validated = $request->validate([
            'question' => 'required|string|max:500',
        ] + self::HISTORY_RULES);

        $prompt = "Tu es l'assistant de la plateforme Intelligence Comptabilité. " . self::STYLE_RULES
            . "Tu parles à un visiteur non connecté : réponds aux questions générales sur la comptabilité et la plateforme. "
            . "Tu n'as accès à aucune donnée d'entreprise ; si on t'en demande, invite le visiteur à se connecter.";

        return $this->reply($prompt, $validated['history'] ?? [], $validated['question']);
    }

    /** Même périmètre que TicketController::index — un admin simple ne voit que ses tickets. */
    private function ticketsFor(Administrateur $admin): array
    {
        $query = Ticket::with([
            'assignee:id,nom,entreprise',
            'client:id,nom',
            'facturation:id,ticket_id,numero,statut,net_facture',
        ])->latest();

        if (!$admin->is_super_admin) {
            $query->where('assigned_to', $admin->id);
        }

        // Seulement les champs utiles — pas d'emails, descriptions ni pièces jointes envoyés à Gemini.
        return $query->limit(200)->get()->map(fn(Ticket $t) => [
            'titre'         => $t->titre,
            'statut'        => self::TICKET_STATUTS[$t->statut] ?? $t->statut,
            'priorite'      => $t->priorite,
            'echeance'      => $t->date_echeance?->format('d/m/Y'),
            'assigne_a'     => $t->assignee
                ? $t->assignee->nom . ($t->assignee->entreprise ? " ({$t->assignee->entreprise})" : '')
                : null,
            'client'        => $t->client?->nom,
            'marque_facture' => (bool) $t->facture,
            'facture_emise' => $t->facturation
                ? [
                    'numero'      => $t->facturation->numero,
                    'statut'      => self::FACTURE_STATUTS[$t->facturation->statut] ?? $t->facturation->statut,
                    'net_facture' => $t->facturation->net_facture,
                ]
                : null,
        ])->all();
    }

    private function reply(string $systemPrompt, array $history, string $question)
    {
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json(['message' => 'Assistant indisponible (clé API non configurée).'], 500);
        }

        $contents = [];
        foreach ($history as $turn) {
            $contents[] = [
                'role'  => $turn['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $turn['text']]],
            ];
        }
        $contents[] = ['role' => 'user', 'parts' => [['text' => $question]]];

        $rateLimited = false;

        foreach (self::AI_MODELS as ['model' => $model, 'api' => $api]) {
            $url = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";
            $response = Http::withoutVerifying()->timeout(30)->post($url, [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents'          => $contents,
                // Large budget: gemini-2.5 counts its internal "thinking" tokens here, and 2048 cut answers short.
                'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 8192],
            ]);

            if (!$response->successful()) {
                if ($response->status() === 429) $rateLimited = true;
                Log::warning('ChatbotController — échec modèle', [
                    'model' => $model, 'status' => $response->status(),
                    'body'  => mb_substr($response->body(), 0, 300),
                ]);
                continue;
            }

            $text = $response->json('candidates.0.content.parts.0.text');
            if ($text) {
                return response()->json(['reply' => $text]);
            }
        }

        $message = $rateLimited
            ? 'Quota IA temporairement atteint — réessayez dans une minute.'
            : "L'assistant est indisponible pour le moment.";
        return response()->json(['message' => $message], 502);
    }
}
