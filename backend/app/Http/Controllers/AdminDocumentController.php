<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesClientAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use App\Models\Administrateur;
use App\Models\Client;
use App\Models\Notification;
use App\Models\FactureAchat;
use App\Models\FactureVente;
use App\Models\ReleveBancaire;
use App\Models\DeclarationFiscale;
use App\Models\DeclarationSociale;
use App\Models\EcheancierLeasing;

class AdminDocumentController extends Controller
{
    use AuthorizesClientAccess;

    /** Every action here is admin-only and limited to the admin's own cabinet. */
    private function ensureAdmin(Request $request): Administrateur
    {
        $user = $request->user();
        abort_unless($user instanceof Administrateur, 403, 'Accès refusé.');
        return $user;
    }

    public function updateStatus(Request $request, string $source, int $id)
    {
        $this->ensureAdmin($request);

        $modelMap = [
            'achat'   => FactureAchat::class,
            'vente'   => FactureVente::class,
            'releve'  => ReleveBancaire::class,
            'fiscale' => DeclarationFiscale::class,
            'sociale' => DeclarationSociale::class,
            'leasing' => EcheancierLeasing::class,
        ];

        $fieldMap = [
            'achat'   => 'statut',
            'vente'   => 'statut_reglement',
            'releve'  => 'rapproche',
            'fiscale' => 'statut',
            'sociale' => 'statut',
            'leasing' => 'statut',
        ];

        if (!isset($modelMap[$source])) {
            return response()->json(['error' => 'Source invalide'], 422);
        }

        $field = $fieldMap[$source];
        $value = $request->validate([
            'value' => $field === 'rapproche' ? 'required|boolean' : 'required|string|max:50',
        ])['value'];

        $model = $modelMap[$source]::findOrFail($id);
        $this->authorizeAccess($request, $model->client_id);
        $model->update([$field => $value]);

        return response()->json(['success' => true]);
    }

    public function notifyRename(Request $request)
    {
        $admin = $this->ensureAdmin($request);

        $request->validate([
            'client_id' => 'required|integer',
            'source'    => 'required|string|max:50',
            'old_name'  => 'required|string|max:255',
            'new_name'  => 'required|string|max:255',
        ]);

        $client = Client::visibleTo($admin)->find($request->client_id);
        if (!$client) {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        // DB notification for the client
        Notification::create([
            'client_id' => $client->id,
            'titre'     => 'Modification de document',
            'message'   => "L'administrateur a renommé votre document « {$request->old_name} » en « {$request->new_name} ».",
            'type'      => 'edit',
            'lu'        => false,
        ]);

        // Email notification
        try {
            Mail::raw(
                "Bonjour {$client->nom},\n\n" .
                "L'administrateur a modifié le nom de votre document :\n\n" .
                "  Ancien nom  : {$request->old_name}\n" .
                "  Nouveau nom : {$request->new_name}\n\n" .
                "Connectez-vous à votre espace pour voir les changements.\n\n" .
                "Cordialement,\nL'équipe Intelligence Comptabilité",
                fn ($msg) => $msg
                    ->to($client->email)
                    ->subject('Votre document a été modifié — Intelligence Comptabilité')
            );
        } catch (\Exception) {
            // Email failure must not block the response
        }

        return response()->json(['success' => true]);
    }
}
