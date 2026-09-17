<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Client;
use App\Models\Message;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MessageController extends Controller
{
    // Resolve the client a thread belongs to and authorize the current user against it.
    private function resolveClient(Request $request, int $clientId): Client|\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $client = Client::find($clientId);
        if (!$client) {
            return response()->json(['message' => 'Client introuvable.'], 404);
        }

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            if ($adminEntreprise !== '' && trim(strtolower($client->entreprise ?? '')) !== $adminEntreprise) {
                return response()->json(['message' => 'Accès refusé.'], 403);
            }
        } else {
            if ($user->id !== $client->id) {
                return response()->json(['message' => 'Accès refusé.'], 403);
            }
        }

        return $client;
    }

    // Is at least one admin of this entreprise currently logged in (active token used recently)?
    private function hasOnlineAdmin(?string $entreprise): bool
    {
        $entreprise = trim(strtolower($entreprise ?? ''));
        $query = Administrateur::query();
        if ($entreprise !== '') {
            $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$entreprise]);
        }
        $adminIds = $query->pluck('id');
        if ($adminIds->isEmpty()) return false;

        return \Illuminate\Support\Facades\DB::table('personal_access_tokens')
            ->where('tokenable_type', Administrateur::class)
            ->whereIn('tokenable_id', $adminIds)
            ->where('last_used_at', '>=', now()->subMinutes(2))
            ->exists();
    }

    // Does this client have an active session right now?
    private function isClientOnline(Client $client): bool
    {
        return $client->tokens()
            ->whereNotNull('last_used_at')
            ->where('last_used_at', '>=', now()->subMinutes(2))
            ->exists();
    }

    // GET /messages/conversations — admin only: one row per client with last message + unread count
    public function conversations(Request $request)
    {
        $admin = $request->user();
        if (!($admin instanceof Administrateur)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        $adminEntreprise = trim(strtolower($admin->entreprise ?? ''));
        $query = Client::where('is_approved', true);
        if ($adminEntreprise !== '') {
            $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]);
        }
        $clients = $query->get();

        $rows = $clients->map(function (Client $client) {
            $last = Message::where('client_id', $client->id)->latest()->first();
            $unread = Message::where('client_id', $client->id)
                ->where('sender_type', 'client')
                ->whereNull('read_at')
                ->count();

            return [
                'client_id'    => $client->id,
                'nom'          => $client->nom,
                'email'        => $client->email,
                'avatar'       => $client->avatar,
                'is_connected' => $this->isClientOnline($client),
                'last_message' => $last?->body,
                'last_sender'  => $last?->sender_type,
                'last_is_bot'  => $last?->is_bot ?? false,
                'last_at'      => $last?->created_at,
                'unread_count' => $unread,
            ];
        })
        ->sortByDesc(fn ($r) => $r['last_at'] ?? '1970-01-01')
        ->values();

        return response()->json($rows);
    }

    // GET /messages/{clientId} — full thread; marks the other party's messages as read
    public function index(Request $request, int $clientId)
    {
        $client = $this->resolveClient($request, $clientId);
        if ($client instanceof \Illuminate\Http\JsonResponse) return $client;

        $isAdmin = $request->user() instanceof Administrateur;

        Message::where('client_id', $clientId)
            ->where('sender_type', $isAdmin ? 'client' : 'admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $messages = Message::with('senderAdmin')
            ->where('client_id', $clientId)
            ->orderBy('created_at')
            ->get();

        $counterpartOnline = $isAdmin
            ? $this->isClientOnline($client)
            : $this->hasOnlineAdmin($client->entreprise);

        return response()->json([
            'messages'           => $messages,
            'counterpart_online' => $counterpartOnline,
        ]);
    }

    // POST /messages/{clientId}
    public function store(Request $request, int $clientId)
    {
        $client = $this->resolveClient($request, $clientId);
        if ($client instanceof \Illuminate\Http\JsonResponse) return $client;

        $validated = $request->validate([
            'body'             => 'nullable|string|max:4000',
            'fichier'          => 'nullable|file|max:25600', // 25 Mo
            'attachment_kind'  => 'nullable|string|in:voice',
        ]);

        $body = trim($validated['body'] ?? '');
        if ($body === '' && !$request->hasFile('fichier')) {
            return response()->json(['message' => 'Message vide.'], 422);
        }

        $user    = $request->user();
        $isAdmin = $user instanceof Administrateur;

        $attachment = [
            'attachment_path' => null, 'attachment_type' => null,
            'attachment_name' => null, 'attachment_mime' => null, 'attachment_size' => null,
        ];
        if ($request->hasFile('fichier')) {
            $file = $request->file('fichier');

            if ($request->input('attachment_kind') === 'voice') {
                // The composer's own mic recorder tells us directly what this is — trust
                // that over sniffing, since libmagic frequently reports audio-only
                // WebM/Ogg recordings as "video/…" (the container alone doesn't say
                // whether a video track is present).
                $clientMime = $file->getClientMimeType();
                $mime = ($clientMime && str_starts_with($clientMime, 'audio/')) ? $clientMime : 'audio/webm';
                $type = 'audio';
            } else {
                $mime = $file->getMimeType() ?: 'application/octet-stream';
                $type = match (true) {
                    str_starts_with($mime, 'image/') => 'image',
                    str_starts_with($mime, 'video/') => 'video',
                    str_starts_with($mime, 'audio/') => 'audio',
                    default => 'file',
                };
            }

            $attachment = [
                'attachment_path' => $file->store("messages/{$clientId}", 'public'),
                'attachment_type' => $type,
                'attachment_name' => $file->getClientOriginalName(),
                'attachment_mime' => $mime,
                'attachment_size' => $file->getSize(),
            ];
        }

        $message = Message::create(array_merge([
            'client_id'       => $clientId,
            'sender_type'     => $isAdmin ? 'admin' : 'client',
            'sender_admin_id' => $isAdmin ? $user->id : null,
            'body'            => $body,
        ], $attachment));

        $previewLabels = ['image' => '📷 Photo', 'video' => '🎥 Vidéo', 'audio' => '🎤 Message vocal', 'file' => '📎 Fichier'];
        $preview = $body !== ''
            ? mb_strimwidth($body, 0, 140, '…')
            : ($previewLabels[$attachment['attachment_type']] ?? '📎 Pièce jointe');
        if ($isAdmin) {
            // In-app only — no email, to avoid spamming the client on every message.
            Notification::create([
                'client_id' => $clientId,
                'titre'     => 'Nouveau message',
                'message'   => $preview,
                'type'      => 'info',
            ]);
        } else {
            NotificationController::notifyAdmins("Message de {$client->nom}", $preview, 'info');

            // No admin currently online → have the assistant reassure the client,
            // but don't repeat it if it already said so recently in this thread.
            if (!$this->hasOnlineAdmin($client->entreprise)) {
                $lastBot = Message::where('client_id', $clientId)
                    ->where('is_bot', true)
                    ->latest()
                    ->first();

                if (!$lastBot || $lastBot->created_at->lt(now()->subMinutes(30))) {
                    Message::create([
                        'client_id'       => $clientId,
                        'sender_type'     => 'admin',
                        'sender_admin_id' => null,
                        'is_bot'          => true,
                        'body'            => "Merci pour votre message ! Aucun administrateur n'est disponible pour le moment, mais un administrateur vous répondra le plus tôt possible. 🙏",
                    ]);
                }
            }
        }

        return response()->json($message->load('senderAdmin'), 201);
    }

    // GET /messages/{clientId}/attachment/{messageId}
    public function attachment(Request $request, int $clientId, int $messageId)
    {
        $client = $this->resolveClient($request, $clientId);
        if ($client instanceof \Illuminate\Http\JsonResponse) return $client;

        $message = Message::where('client_id', $clientId)->findOrFail($messageId);
        if (!$message->attachment_path || !Storage::disk('public')->exists($message->attachment_path)) {
            abort(404, 'Pièce jointe non disponible.');
        }

        $path = Storage::disk('public')->path($message->attachment_path);

        return response()->file($path, [
            'Content-Type'  => $message->attachment_mime ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    // GET /messages/unread-count — badge count for the current user
    public function unreadCount(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $adminEntreprise = trim(strtolower($user->entreprise ?? ''));
            $clientIds = Client::when($adminEntreprise !== '', fn ($q) =>
                $q->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise])
            )->pluck('id');

            $count = Message::whereIn('client_id', $clientIds)
                ->where('sender_type', 'client')
                ->whereNull('read_at')
                ->count();
        } else {
            $count = Message::where('client_id', $user->id)
                ->where('sender_type', 'admin')
                ->whereNull('read_at')
                ->count();
        }

        return response()->json(['count' => $count]);
    }
}
