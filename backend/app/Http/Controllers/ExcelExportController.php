<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\ExcelExport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExcelExportController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = ExcelExport::query()->latest();

        if ($user instanceof Administrateur) {
            $clientId = (int) $request->query('client_id', 0);
            if (!$clientId) {
                return response()->json(['message' => 'client_id requis.'], 422);
            }
            $query->where('client_id', $clientId);
        } else {
            $query->where('client_id', $user->id);
        }

        return response()->json($query->get());
    }

    public function fichier(Request $request, int $id)
    {
        $export = ExcelExport::findOrFail($id);
        $this->authorizeAccess($request, $export->client_id);

        if (!Storage::disk('public')->exists($export->fichier)) {
            abort(404, 'Fichier non disponible.');
        }

        return response()->file(Storage::disk('public')->path($export->fichier), [
            'Content-Type'  => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $export = ExcelExport::findOrFail($id);
        $this->authorizeAccess($request, $export->client_id);

        if (Storage::disk('public')->exists($export->fichier)) {
            Storage::disk('public')->delete($export->fichier);
        }
        $export->delete();

        return response()->json(['message' => 'Fichier supprimé.']);
    }

    private function authorizeAccess(Request $request, int $clientId): void
    {
        $user = $request->user();
        if (!($user instanceof Administrateur) && $user->id !== $clientId) {
            abort(403, 'Accès non autorisé.');
        }
    }
}
