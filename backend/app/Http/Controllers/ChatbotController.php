<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\DocumentFiscal;
use App\Models\Ticket;
use App\Services\DocumentationFiscaleSearch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

    // Un PDF scanné (sans texte extractible) est envoyé tel quel à Gemini s'il est le meilleur résultat
    private const MAX_PDF_BYTES = 10 * 1024 * 1024;

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

    // Périmètre : l'assistant répond à tout, avec un ordre de priorité des sources.
    private const SCOPE_RULES = "\n\n### Périmètre\n"
        . "Tu réponds à TOUTES les questions, y compris celles qui sortent de la comptabilité et de la plateforme "
        . "(culture générale, informatique, Excel, rédaction de courriers, droit, gestion d'entreprise, actualité…), "
        . "en restant professionnel et bienveillant. Ne refuse que les demandes illégales, dangereuses ou malveillantes.\n"
        . "Ordre de priorité des sources :\n"
        . "1. Les données de l'entreprise pour toute question sur l'entreprise de l'utilisateur.\n"
        . "2. La documentation fiscale (extraits fournis) pour les questions fiscales et juridiques tunisiennes.\n"
        . "3. Le guide de la plateforme pour toute question sur l'utilisation du site : où trouver une fonction, comment faire une action.\n"
        . "4. Tes connaissances générales (et la recherche web si elle est disponible) pour le reste.\n"
        . "Pour les questions sur la plateforme, base-toi UNIQUEMENT sur le guide : n'invente jamais un bouton, une page ou une "
        . "fonctionnalité. Si quelque chose n'existe pas, dis-le simplement et propose de contacter le cabinet via la Messagerie. "
        . "Pour une information qui a pu changer récemment (taux, montants, actualité) sans source fiable, précise qu'elle est à vérifier.\n";

    /** Platform guide (resources/ai/guide-plateforme.md); the admin section is only given to admins. */
    private function platformGuide(bool $withAdmin): string
    {
        $guide = Cache::remember('chatbot:guide:' . ($withAdmin ? 'admin' : 'client'), 3600, function () use ($withAdmin) {
            $path = resource_path('ai/guide-plateforme.md');
            if (!is_file($path)) return '';
            $text = (string) file_get_contents($path);
            if (!$withAdmin) {
                $text = preg_replace('/^## Espace administrateur.*?(?=^## )/ms', '', $text) ?? $text;
            }
            return trim($text);
        });

        return $guide === '' ? '' : "\n\n### Guide de la plateforme (référence pour les questions sur le site)\n" . $guide . "\n";
    }

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

        $prompt = "Tu es un assistant comptable, financier et fiscal intelligent, spécialiste de la fiscalité tunisienne. " . self::STYLE_RULES
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

        // Documentation fiscale : passages des PDF qui correspondent à la question (+ question précédente pour les suivis)
        $lastUserTurn = collect($validated['history'] ?? [])->where('role', 'user')->last()['text'] ?? '';
        [$docPrompt, $attachments, $sources] = $this->documentationContext(trim($validated['question'] . ' ' . mb_substr($lastUserTurn, 0, 300)));
        $prompt .= $docPrompt . self::SCOPE_RULES . $this->platformGuide($user instanceof Administrateur);

        return $this->reply($prompt, $validated['history'] ?? [], $validated['question'], $attachments, ['sources' => $sources]);
    }

    /**
     * Builds the documentation fiscale part of the prompt.
     *
     * @return array{0: string, 1: array, 2: array} prompt text, extra Gemini parts (scanned PDF), sources for the widget
     */
    private function documentationContext(string $query): array
    {
        $rules = "\n\n### Documentation fiscale\n"
            . "Tu as accès à la bibliothèque de documentation fiscale de la plateforme : lois de finances, notes communes, "
            . "conventions de non double imposition et codes fiscaux tunisiens. Ne dis JAMAIS que tu n'as pas accès aux lois de finances "
            . "ou aux textes fiscaux.\n";

        try {
            $groups = app(DocumentationFiscaleSearch::class)->search($query);
        } catch (\Throwable $e) {
            Log::warning('Recherche documentation fiscale échouée', ['error' => $e->getMessage()]);
            $groups = [];
        }

        if (!$groups) {
            return [$rules . "Aucun extrait de la bibliothèque ne correspond à cette question. Si elle est fiscale, réponds avec tes "
                . "connaissances de la fiscalité tunisienne en précisant que c'est à vérifier, et invite l'utilisateur à consulter "
                . "la rubrique « Documentation fiscale » du menu.\n", [], []];
        }

        $text = $rules . "Voici les extraits de la bibliothèque les plus proches de la question :\n";
        foreach ($groups as $i => $g) {
            /** @var DocumentFiscal $doc */
            $doc  = $g['doc'];
            $meta = implode(', ', array_filter([DocumentFiscal::CATEGORIE_LABELS[$doc->categorie] ?? null, $doc->annee, $doc->sous_categorie]));
            $text .= "\n[Document " . ($i + 1) . "] « {$doc->titre} » ({$meta})\n";
            foreach ($g['passages'] as $p) {
                $text .= $p['page'] > 0 ? "— page {$p['page']} :\n{$p['contenu']}\n" : "— fiche : {$p['contenu']}\n";
            }
        }

        // Best match is a scanned PDF (no text): send the file itself so Gemini can read it
        $attachments = [];
        $top = $groups[0]['doc'];
        if (($top->nb_caracteres ?? 0) < DocumentationFiscaleSearch::SCANNED_THRESHOLD
            && $top->taille && $top->taille <= self::MAX_PDF_BYTES
            && Storage::disk('local')->exists($top->fichier)) {
            $attachments[] = ['inline_data' => [
                'mime_type' => 'application/pdf',
                'data'      => base64_encode(Storage::disk('local')->get($top->fichier)),
            ]];
            $text .= "\nLe PDF complet de « {$top->titre} » (document scanné) est joint au message : lis-le pour répondre.\n";
        }

        $text .= "\nRègles pour les questions fiscales, juridiques ou réglementaires :\n"
            . "- Appuie-toi d'abord sur ces extraits et cite la source entre parenthèses, ex. (« Loi de finances 2026 », p. 12).\n"
            . "- Les extraits viennent d'une extraction PDF : ils peuvent être en arabe ou mal mis en forme. Traduis et reformule en français.\n"
            . "- Si les extraits ne répondent pas à la question, dis-le, complète avec tes connaissances en précisant qu'elles sont à vérifier, "
            . "et invite à consulter la rubrique « Documentation fiscale ».\n"
            . "- Ignore ces extraits si la question porte sur les données de l'entreprise (factures, relevés, tickets…) "
            . "ou n'a rien à voir avec la fiscalité.\n";

        $sources = array_map(fn ($g) => [
            'id'        => $g['doc']->id,
            'titre'     => $g['doc']->titre,
            'categorie' => $g['doc']->categorie,
            'annee'     => $g['doc']->annee,
            'pages'     => array_values(array_unique(array_filter(array_column($g['passages'], 'page')))),
        ], array_slice($groups, 0, 4));

        return [$text, $attachments, $sources];
    }

    /**
     * Keeps only the documents the answer actually cites, so a non-fiscal answer
     * (Excel formula, general question…) does not list unrelated sources.
     */
    private function citedSources(array $sources, string $reply): array
    {
        $words = fn (string $t) => preg_split('/[^a-z0-9]+/', mb_strtolower(Str::ascii($t)), -1, PREG_SPLIT_NO_EMPTY);
        $replyText  = implode(' ', $words($reply));
        $replyWords = array_flip($words($reply));

        return array_values(array_filter($sources, function ($src) use ($words, $replyText, $replyWords) {
            // Notes communes are cited by number: "note commune n° 13"
            if (preg_match('/note\s*commune\s*(?:n\S*|num\S*ro)?\s*0*(\d{1,3})/iu', $src['titre'], $m)) {
                return (bool) preg_match('/note commune (?:n |no |numero )?0*' . $m[1] . '\b/', $replyText);
            }
            // Other documents: most of the significant words of the start of the title appear in the answer
            $key = array_slice(array_filter($words($src['titre']), fn ($w) => strlen($w) > 2 || ctype_digit($w)), 0, 6);
            if (!$key) return false;
            $found = count(array_filter($key, fn ($w) => isset($replyWords[$w])));
            return $found / count($key) >= 0.8;
        }));
    }

    /** Page d'accueil publique : aucune donnée privée, questions générales uniquement. */
    public function askPublic(Request $request)
    {
        $validated = $request->validate([
            'question' => 'required|string|max:500',
        ] + self::HISTORY_RULES);

        $prompt = "Tu es l'assistant de la plateforme Intelligence Comptabilité, un cabinet comptable en ligne en Tunisie. " . self::STYLE_RULES
            . "Tu parles à un visiteur non connecté. Tu n'as accès à aucune donnée d'entreprise ni à la bibliothèque de documentation "
            . "fiscale (réservée aux utilisateurs connectés) : si on t'en demande, invite le visiteur à créer un compte ou à se connecter."
            . self::SCOPE_RULES . $this->platformGuide(false);

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

    private function reply(string $systemPrompt, array $history, string $question, array $attachments = [], array $extra = [])
    {
        $apiKey = config('services.gemini.key');
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
        $contents[] = ['role' => 'user', 'parts' => [...$attachments, ['text' => $question]]];

        $rateLimited = false;

        foreach (self::AI_MODELS as ['model' => $model, 'api' => $api]) {
            $url = "https://generativelanguage.googleapis.com/{$api}/models/{$model}:generateContent?key={$apiKey}";
            $response = Http::withoutVerifying()->timeout($attachments ? 90 : 45)->post($url, [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents'          => $contents,
                // Large budget: gemini-2.5 counts its internal "thinking" tokens here, and 2048 cut answers short.
                'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 8192],
            ] + (config('services.gemini.google_search')
                // Lets Gemini search the web for recent information (billed separately by Google beyond the free quota)
                ? ['tools' => [['google_search' => new \stdClass()]]]
                : []));

            if (!$response->successful()) {
                if ($response->status() === 429) $rateLimited = true;
                Log::warning('ChatbotController — échec modèle', [
                    'model' => $model, 'status' => $response->status(),
                    'body'  => mb_substr($response->body(), 0, 300),
                ]);
                continue;
            }

            // The answer can come in several parts; skip the model's internal "thought" parts
            $text = collect($response->json('candidates.0.content.parts') ?? [])
                ->reject(fn ($part) => !empty($part['thought']))
                ->pluck('text')->filter()->implode('');
            if ($text) {
                $web = collect($response->json('candidates.0.groundingMetadata.groundingChunks') ?? [])
                    ->pluck('web')->filter(fn ($w) => !empty($w['uri']))
                    ->map(fn ($w) => ['titre' => $w['title'] ?? $w['uri'], 'url' => $w['uri']])
                    ->unique('url')->take(5)->values()->all();
                if (isset($extra['sources'])) {
                    $extra['sources'] = $this->citedSources($extra['sources'], $text);
                }
                return response()->json(['reply' => $text] + $extra + ($web ? ['web_sources' => $web] : []));
            }
        }

        $message = $rateLimited
            ? 'Quota IA temporairement atteint — réessayez dans une minute.'
            : "L'assistant est indisponible pour le moment.";
        return response()->json(['message' => $message], 502);
    }
}
