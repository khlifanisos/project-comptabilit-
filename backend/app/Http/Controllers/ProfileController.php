<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Http\Controllers\NotificationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'nom'        => 'sometimes|string|max:100',
            'email'      => 'sometimes|email|max:150',
            'entreprise' => 'nullable|string|max:150',
            'telephone'  => 'nullable|string|max:20',
            'adresse'    => 'nullable|string|max:500',
        ]);

        if (isset($validated['email']) && $validated['email'] !== $user->email) {
            $model = $user instanceof Administrateur ? Administrateur::class : \App\Models\Client::class;
            if ($model::where('email', $validated['email'])->where('id', '!=', $user->id)->exists()) {
                throw ValidationException::withMessages(['email' => 'Email déjà utilisé.']);
            }
        }

        $user->update($validated);
        $role = $user instanceof Administrateur ? 'admin' : 'client';

        if ($role === 'client') {
            NotificationController::sendAndNotify(
                $user->id,
                'Profil mis à jour',
                'Vos informations de profil ont été modifiées avec succès.',
                'info'
            );
        }
        NotificationController::notifyAdmins(
            'Profil modifié',
            "Le {$role} \"{$user->nom}\" ({$user->email}) a modifié son profil.",
            'info'
        );

        return response()->json(array_merge($user->toArray(), ['role' => $role]));
    }

    public function updatePhoto(Request $request)
    {
        $request->validate(['avatar' => 'nullable|string']);

        $user     = $request->user();
        $isAdmin  = $user instanceof Administrateur;
        $role     = $isAdmin ? 'admin' : 'client';
        $base64   = $request->input('avatar');

        // Delete old file if exists
        if ($user->avatar && str_contains($user->avatar, '/uploads/avatars/')) {
            $oldPath = public_path('uploads/avatars/' . basename($user->avatar));
            if (file_exists($oldPath)) @unlink($oldPath);
        }

        $avatarUrl = null;

        if ($base64) {
            // Strip data URI prefix  e.g. "data:image/png;base64,..."
            $data = str_contains($base64, ',') ? explode(',', $base64)[1] : $base64;
            $imageData = base64_decode($data);

            $dir = public_path('uploads/avatars');
            if (!is_dir($dir)) mkdir($dir, 0755, true);

            $filename = $role . '_' . $user->id . '.jpg';
            file_put_contents($dir . '/' . $filename, $imageData);

            // Cache-bust: the filename is stable per user (always overwritten in
            // place), so without a version suffix the URL never changes between
            // uploads — React sees the same string and skips re-rendering the
            // <img>, and the browser keeps showing its cached copy until a full
            // page reload forces a re-fetch. Appending a timestamp makes every
            // upload produce a genuinely new URL.
            $avatarUrl = config('app.url') . '/uploads/avatars/' . $filename . '?v=' . time();
        }

        $user->update(['avatar' => $avatarUrl]);
        return response()->json(array_merge($user->fresh()->toArray(), ['role' => $role]));
    }

    public function updateNotifications(Request $request)
    {
        $request->validate([
            'notif_email'    => 'required|boolean',
            'notif_platform' => 'required|boolean',
        ]);

        $user = $request->user();
        $user->update([
            'notif_email'    => $request->boolean('notif_email'),
            'notif_platform' => $request->boolean('notif_platform'),
        ]);

        $role = $user instanceof Administrateur ? 'admin' : 'client';
        return response()->json(array_merge($user->fresh()->toArray(), ['role' => $role]));
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current'      => 'required|string',
            'password'     => 'required|string|min:8',
            'confirmation' => 'required|same:password',
        ]);

        $user = $request->user();
        if (!Hash::check($request->current, $user->mot_de_passe)) {
            throw ValidationException::withMessages(['current' => 'Mot de passe actuel incorrect.']);
        }

        $user->update(['mot_de_passe' => Hash::make($request->password)]);
        $role = $user instanceof Administrateur ? 'admin' : 'client';

        if ($role === 'client') {
            NotificationController::sendAndNotify(
                $user->id,
                'Mot de passe modifié',
                'Votre mot de passe a été changé avec succès. Si ce n\'est pas vous, contactez l\'administrateur.',
                'alert'
            );
        }
        NotificationController::notifyAdmins(
            'Mot de passe modifié',
            "Le {$role} \"{$user->nom}\" ({$user->email}) a changé son mot de passe.",
            'alert'
        );

        return response()->json(['message' => 'Mot de passe mis à jour.']);
    }
}
