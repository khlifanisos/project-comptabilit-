<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\DocumentFiscal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Documentation fiscale: library of PDFs (lois de finances, notes communes, ...)
 * readable by every logged-in user, managed by admins only.
 */
class DocumentFiscalController extends Controller
{
    // Private disk (storage/app/private): files are only reachable through this controller
    private const DISK = 'local';

    private function denyUnlessAdmin(Request $request): ?\Illuminate\Http\JsonResponse
    {
        return $request->user() instanceof Administrateur
            ? null
            : response()->json(['message' => 'Accès refusé.'], 403);
    }

    private function rules(): array
    {
        return [
            'categorie'   => ['required', Rule::in(DocumentFiscal::CATEGORIES)],
            'annee'          => 'nullable|integer|min:1956|max:2100',
            'sous_categorie' => 'nullable|string|max:150',
            'titre'          => 'required|string|max:200',
            'description'    => 'nullable|string|max:1000',
        ];
    }

    public function index(Request $request)
    {
        $request->validate([
            'categorie' => ['nullable', Rule::in(DocumentFiscal::CATEGORIES)],
            'q'         => 'nullable|string|max:100',
            'limit'     => 'nullable|integer|min:1|max:100',
        ]);

        // Search: every word must appear in the title or sub-category (accent/case-insensitive via the column collation)
        $words = preg_split('/\s+/', trim((string) $request->q), -1, PREG_SPLIT_NO_EMPTY);

        $docs = DocumentFiscal::query()
            ->when($request->categorie, fn ($q, $c) => $q->where('categorie', $c))
            ->when($words, function ($q) use ($words) {
                foreach ($words as $w) {
                    $like = '%' . addcslashes($w, '%_\\') . '%';
                    $q->where(fn ($q) => $q->where('titre', 'like', $like)->orWhere('sous_categorie', 'like', $like));
                }
            })
            ->orderByDesc('annee')
            ->orderBy('sous_categorie')
            ->orderBy('titre')
            ->when($request->limit, fn ($q, $l) => $q->limit($l))
            ->get();

        return response()->json($docs);
    }

    /** Number of documents per category, for the landing grid. */
    public function stats()
    {
        return response()->json(
            DocumentFiscal::query()
                ->selectRaw('categorie, COUNT(*) as total')
                ->groupBy('categorie')
                ->pluck('total', 'categorie')
        );
    }

    public function store(Request $request)
    {
        if ($deny = $this->denyUnlessAdmin($request)) return $deny;

        $validated = $request->validate($this->rules() + [
            'fichier' => 'required|file|mimes:pdf|max:51200', // 50 Mo
        ]);

        $file = $request->file('fichier');
        $path = $file->store('documents_fiscaux', self::DISK);

        $doc = DocumentFiscal::create([
            'categorie'    => $validated['categorie'],
            'annee'          => $validated['annee'] ?? null,
            'sous_categorie' => $validated['sous_categorie'] ?? null,
            'titre'          => $validated['titre'],
            'description'  => $validated['description'] ?? null,
            'fichier'      => $path,
            'nom_original' => $file->getClientOriginalName(),
            'taille'       => $file->getSize(),
            'admin_id'     => $request->user()->id,
        ]);

        return response()->json($doc, 201);
    }

    public function update(Request $request, int $id)
    {
        if ($deny = $this->denyUnlessAdmin($request)) return $deny;

        $doc = DocumentFiscal::findOrFail($id);
        $doc->update($request->validate($this->rules()));

        return response()->json($doc);
    }

    public function destroy(Request $request, int $id)
    {
        if ($deny = $this->denyUnlessAdmin($request)) return $deny;

        $doc = DocumentFiscal::findOrFail($id);
        Storage::disk(self::DISK)->delete($doc->fichier);
        $doc->delete();

        return response()->json(['message' => 'Document supprimé.']);
    }

    /** Streams the PDF; ?download=1 forces a download with a readable filename. */
    public function fichier(Request $request, int $id)
    {
        $doc  = DocumentFiscal::findOrFail($id);
        $disk = Storage::disk(self::DISK);
        if (!$disk->exists($doc->fichier)) {
            abort(404, 'Fichier non disponible.');
        }

        $headers = ['Content-Type' => 'application/pdf', 'Cache-Control' => 'private, max-age=3600'];

        return $request->boolean('download')
            ? $disk->download($doc->fichier, (Str::slug($doc->titre) ?: 'document') . '.pdf', $headers)
            : response()->file($disk->path($doc->fichier), $headers);
    }
}
