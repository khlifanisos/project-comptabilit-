<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\TexteLoi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TexteLoiController extends Controller
{
    private function adminGuard(Request $request): Administrateur|\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }
        return $user;
    }

    public function index(Request $request)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        return response()->json(TexteLoi::with('admin')->latest()->get());
    }

    public function store(Request $request)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $validated = $request->validate([
            'titre'       => 'required|string|max:150',
            'description' => 'nullable|string|max:1000',
            'fichier'     => 'required|file|mimes:pdf|max:20480',
        ]);

        $file = $request->file('fichier');
        $path = $file->store('textes_lois', 'public');

        $texte = TexteLoi::create([
            'titre'       => $validated['titre'],
            'description' => $validated['description'] ?? null,
            'fichier'     => $path,
            'taille'      => $file->getSize(),
            'admin_id'    => $admin->id,
        ]);

        return response()->json($texte->load('admin'), 201);
    }

    public function destroy(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $texte = TexteLoi::findOrFail($id);
        if ($texte->fichier && Storage::disk('public')->exists($texte->fichier)) {
            Storage::disk('public')->delete($texte->fichier);
        }
        $texte->delete();

        return response()->json(['message' => 'Document supprimé.']);
    }

    public function fichier(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $texte = TexteLoi::findOrFail($id);
        if (!$texte->fichier || !Storage::disk('public')->exists($texte->fichier)) {
            abort(404, 'Fichier non disponible.');
        }

        $path = Storage::disk('public')->path($texte->fichier);

        return response()->file($path, [
            'Content-Type'  => 'application/pdf',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
