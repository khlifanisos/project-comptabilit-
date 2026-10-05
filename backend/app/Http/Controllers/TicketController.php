<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Ticket;
use App\Models\TicketAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TicketController extends Controller
{
    private const WITH = [
        'creator:id,nom,email,avatar,entreprise',
        'assignee:id,nom,email,avatar,entreprise',
        'attachments.uploader:id,nom,email,avatar',
    ];

    private function canAccess(Administrateur $admin, Ticket $ticket): bool
    {
        return $admin->is_super_admin || $ticket->created_by === $admin->id || $ticket->assigned_to === $admin->id;
    }

    /** Stores the uploaded files for a ticket and returns the created records. */
    private function storeAttachments(Request $request, Ticket $ticket, Administrateur $admin): void
    {
        foreach ((array) $request->file('fichiers', []) as $file) {
            if (!$file) continue;
            $path = $file->store("ticket_attachments/{$ticket->id}", 'public');
            TicketAttachment::create([
                'ticket_id'    => $ticket->id,
                'uploaded_by'  => $admin->id,
                'nom_original' => $file->getClientOriginalName(),
                'fichier'      => $path,
                'mime_type'    => $file->getClientMimeType(),
                'taille'       => $file->getSize(),
            ]);
        }
    }
    public function index(Request $request)
    {
        /** @var Administrateur $admin */
        $admin = $request->user();

        $query = Ticket::with(self::WITH)->latest();

        if (!$admin->is_super_admin) {
            // Regular admin only sees what's assigned to them.
            // A super admin sees every ticket, across every cabinet.
            $query->where('assigned_to', $admin->id);
        }

        return response()->json($query->get());
    }

    /**
     * Admins a super admin can assign a ticket to — every other admin on the
     * platform, not just their own cabinet: a super admin oversees everyone.
     */
    public function assignableAdmins(Request $request)
    {
        $admin = $request->user();
        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Accès réservé au super admin.'], 403);
        }

        $admins = Administrateur::where('id', '!=', $admin->id)
            ->get(['id', 'nom', 'email', 'avatar', 'entreprise']);

        return response()->json($admins);
    }

    public function store(Request $request)
    {
        $admin = $request->user();
        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Seul le super admin peut créer un ticket.'], 403);
        }

        $validated = $request->validate([
            'titre'         => 'required|string|max:200',
            'description'   => 'nullable|string|max:3000',
            'assigned_to'   => 'required|integer',
            'priorite'      => 'nullable|in:basse,normale,haute,urgente',
            'date_echeance' => 'nullable|date',
            'fichiers'      => 'nullable|array|max:10',
            'fichiers.*'    => 'file|mimes:pdf,jpg,jpeg,png,webp,gif|max:10240',
        ]);

        $assignee = Administrateur::find($validated['assigned_to']);
        if (!$assignee) {
            return response()->json(['message' => 'Admin introuvable.'], 422);
        }

        $ticket = Ticket::create([
            'titre'         => $validated['titre'],
            'description'   => $validated['description'] ?? null,
            'created_by'    => $admin->id,
            'assigned_to'   => $assignee->id,
            'priorite'      => $validated['priorite'] ?? 'normale',
            'date_echeance' => $validated['date_echeance'] ?? null,
            'statut'        => 'a_faire',
        ]);

        $this->storeAttachments($request, $ticket, $admin);

        NotificationController::notifyAdmin(
            $assignee->id,
            'Nouveau ticket assigné',
            "{$admin->nom} vous a assigné le ticket « {$ticket->titre} ».",
            'info'
        );

        return response()->json($ticket->load(self::WITH), 201);
    }

    /** Adds files to an already-existing ticket (creator or assignee). */
    public function uploadAttachment(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$this->canAccess($admin, $ticket)) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $request->validate([
            'fichiers'   => 'required|array|max:10',
            'fichiers.*' => 'file|mimes:pdf,jpg,jpeg,png,webp,gif|max:10240',
        ]);

        $this->storeAttachments($request, $ticket, $admin);

        return response()->json($ticket->load(self::WITH), 201);
    }

    public function downloadAttachment(Request $request, int $id, int $attachmentId)
    {
        $admin      = $request->user();
        $ticket     = Ticket::findOrFail($id);
        $attachment = TicketAttachment::where('ticket_id', $ticket->id)->findOrFail($attachmentId);

        if (!$this->canAccess($admin, $ticket)) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }
        if (!Storage::disk('public')->exists($attachment->fichier)) {
            return response()->json(['message' => 'Fichier introuvable.'], 404);
        }

        return Storage::disk('public')->response($attachment->fichier, $attachment->nom_original);
    }

    public function deleteAttachment(Request $request, int $id, int $attachmentId)
    {
        $admin      = $request->user();
        $ticket     = Ticket::findOrFail($id);
        $attachment = TicketAttachment::where('ticket_id', $ticket->id)->findOrFail($attachmentId);

        if (!$admin->is_super_admin && $attachment->uploaded_by !== $admin->id) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        Storage::disk('public')->delete($attachment->fichier);
        $attachment->delete();

        return response()->json(['message' => 'Pièce jointe supprimée.']);
    }

    public function update(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'titre'         => 'sometimes|string|max:200',
            'description'   => 'nullable|string|max:3000',
            'assigned_to'   => 'sometimes|integer',
            'priorite'      => 'sometimes|in:basse,normale,haute,urgente',
            'date_echeance' => 'nullable|date',
        ]);

        if (isset($validated['assigned_to']) && !Administrateur::find($validated['assigned_to'])) {
            return response()->json(['message' => 'Admin introuvable.'], 422);
        }

        $ticket->update($validated);
        return response()->json($ticket->load(self::WITH));
    }

    public function destroy(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $ticket->delete();
        return response()->json(['message' => 'Ticket supprimé.']);
    }

    /** Assignee starts working on a ticket: à faire → en cours. */
    public function start(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if ($ticket->assigned_to !== $admin->id) {
            return response()->json(['message' => 'Ce ticket ne vous est pas assigné.'], 403);
        }
        if ($ticket->statut !== 'a_faire') {
            return response()->json(['message' => 'Ce ticket a déjà été démarré.'], 422);
        }

        $ticket->update(['statut' => 'en_cours']);
        return response()->json($ticket->load(self::WITH));
    }

    /** Assignee submits completed work for the super admin's review. */
    public function submit(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if ($ticket->assigned_to !== $admin->id) {
            return response()->json(['message' => 'Ce ticket ne vous est pas assigné.'], 403);
        }
        if (!in_array($ticket->statut, ['en_cours', 'rejete'], true)) {
            return response()->json(['message' => 'Ce ticket ne peut pas être soumis depuis son statut actuel.'], 422);
        }

        $ticket->update(['statut' => 'en_attente_validation', 'submitted_at' => now()]);

        NotificationController::notifyAdmin(
            $ticket->created_by,
            'Ticket soumis pour validation',
            "{$admin->nom} a soumis le ticket « {$ticket->titre} » pour validation.",
            'info'
        );

        return response()->json($ticket->load(self::WITH));
    }

    /** Super admin approves the submitted work. */
    public function validateTicket(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Accès réservé au super admin.'], 403);
        }
        if ($ticket->statut !== 'en_attente_validation') {
            return response()->json(['message' => 'Ce ticket n\'est pas en attente de validation.'], 422);
        }

        $ticket->update(['statut' => 'valide', 'reviewed_at' => now(), 'commentaire_validation' => null]);

        NotificationController::notifyAdmin(
            $ticket->assigned_to,
            'Ticket validé',
            "{$admin->nom} a validé votre ticket « {$ticket->titre} ».",
            'success'
        );

        return response()->json($ticket->load(self::WITH));
    }

    /** Super admin sends the work back with feedback. */
    public function reject(Request $request, int $id)
    {
        $admin  = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$admin->is_super_admin) {
            return response()->json(['message' => 'Accès réservé au super admin.'], 403);
        }
        if ($ticket->statut !== 'en_attente_validation') {
            return response()->json(['message' => 'Ce ticket n\'est pas en attente de validation.'], 422);
        }

        $validated = $request->validate([
            'commentaire_validation' => 'required|string|max:1000',
        ]);

        $ticket->update([
            'statut'                 => 'rejete',
            'reviewed_at'            => now(),
            'commentaire_validation' => $validated['commentaire_validation'],
        ]);

        NotificationController::notifyAdmin(
            $ticket->assigned_to,
            'Ticket renvoyé',
            "{$admin->nom} a renvoyé votre ticket « {$ticket->titre} » avec des remarques à corriger.",
            'warning'
        );

        return response()->json($ticket->load(self::WITH));
    }
}
