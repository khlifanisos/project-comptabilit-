<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Client;
use App\Models\ClientInvitation;
use App\Models\FactureAchat;
use App\Models\FactureVente;
use App\Models\DeclarationFiscale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ClientController extends Controller
{
    // ── Helpers ────────────────────────────────────────────────

    private function withCounts(Client $client): array
    {
        $id          = $client->id;
        return array_merge($client->toArray(), [
            'nb_factures'     => FactureAchat::where('client_id', $id)->count()
                               + FactureVente::where('client_id', $id)->count(),
            'nb_declarations' => DeclarationFiscale::where('client_id', $id)->count(),
            // Token-based auth has no logout signal for a closed tab, so "online" is
            // approximated from recent activity. Kept short (vs. an hour) so it behaves
            // like an actual presence indicator: the app polls every few seconds while
            // a tab is open, so this stays fresh for real sessions and drops quickly
            // once nothing is open anymore.
            'is_connected'    => $client->tokens()
                                   ->whereNotNull('last_used_at')
                                   ->where('last_used_at', '>=', now()->subMinutes(2))
                                   ->exists(),
        ]);
    }

    private function adminGuard(Request $request): Administrateur|\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }
        return $user;
    }

    // ── CRUD ───────────────────────────────────────────────────

    public function index(Request $request)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $adminEntreprise = trim(strtolower($admin->entreprise ?? ''));

        $query = Client::where('is_approved', true)->orderBy('created_at', 'desc');

        if ($adminEntreprise !== '') {
            $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]);
        }

        $clients = $query->get()->map(fn ($c) => $this->withCounts($c));

        return response()->json($clients);
    }

    public function pending(Request $request)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $adminEntreprise = trim(strtolower($admin->entreprise ?? ''));

        $query = Client::where('is_approved', false)->orderBy('created_at', 'desc');

        if ($adminEntreprise !== '') {
            $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$adminEntreprise]);
        }

        return response()->json($query->get());
    }

    public function approve(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $client = Client::findOrFail($id);
        $client->update(['is_approved' => true, 'is_actif' => true]);

        // Notify the client by email
        $co        = e($admin->entreprise ?: 'Intelligence Comptabilité');
        $an        = e($admin->nom);
        $cn        = e($client->nom);
        $loginUrl  = env('FRONTEND_URL', 'http://localhost:5173') . '/login';

        $this->sendMail(
            $client->email,
            $client->nom,
            "Votre demande a été acceptée — {$co}",
            "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
                <div style='background:linear-gradient(135deg,#2E7D32,#1B5E20);padding:24px;border-radius:8px;text-align:center;margin-bottom:28px;'>
                    <div style='font-size:48px;margin-bottom:8px;'>✅</div>
                    <h2 style='color:white;margin:0;font-size:22px;'>Demande acceptée !</h2>
                </div>

                <p style='font-size:15px;color:#1e293b;'>Bonjour <strong>{$cn}</strong>,</p>

                <p style='font-size:14px;color:#334155;line-height:1.7;'>
                    Nous avons le plaisir de vous informer que votre demande d'adhésion à la plateforme
                    <strong>{$co}</strong> a été <strong style='color:#2E7D32;'>acceptée</strong> par
                    <strong>{$an}</strong>.
                </p>

                <p style='font-size:14px;color:#334155;line-height:1.7;'>
                    Vous avez désormais accès à l'ensemble des fonctionnalités de votre espace client :
                </p>

                <ul style='font-size:14px;color:#334155;line-height:2;padding-left:20px;'>
                    <li>📄 Gestion de vos factures achats et ventes</li>
                    <li>🏦 Suivi de vos relevés bancaires</li>
                    <li>📊 Déclarations fiscales et sociales</li>
                    <li>🤖 Audit intelligent de vos documents</li>
                </ul>

                <div style='text-align:center;margin:32px 0;'>
                    <a href='{$loginUrl}'
                       style='background:linear-gradient(135deg,#2E7D32,#1B5E20);color:white;padding:14px 36px;
                              border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;
                              display:inline-block;'>
                        Se connecter à mon espace
                    </a>
                </div>

                <p style='font-size:13px;color:#64748b;line-height:1.6;'>
                    Si vous avez des questions, n'hésitez pas à contacter votre gestionnaire
                    <strong>{$an}</strong> directement depuis la plateforme.
                </p>

                <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
                <p style='color:#94a3b8;font-size:12px;text-align:center;'>
                    Intelligence Comptabilité — {$co}<br>
                    Ce message a été envoyé automatiquement, merci de ne pas y répondre.
                </p>
            </div>"
        );

        // In-app notification for the client
        \App\Models\Notification::create([
            'client_id' => $client->id,
            'titre'     => 'Demande acceptée',
            'message'   => "Bienvenue {$client->nom} ! Votre compte a été approuvé par {$admin->nom}. Vous avez maintenant accès à tous les services.",
            'type'      => 'success',
        ]);

        NotificationController::notifyAdmins(
            "Client approuvé : {$client->nom}",
            "{$admin->nom} a approuvé la demande de {$client->nom} ({$client->email}).",
            'success'
        );

        return response()->json($this->withCounts($client->fresh()));
    }

    public function update(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $validated = $request->validate([
            'nom'        => 'required|string|max:100',
            'entreprise' => 'nullable|string|max:150',
            'telephone'  => 'nullable|string|max:20',
            'adresse'    => 'nullable|string|max:500',
            'avatar'     => 'nullable|string',
        ]);

        $client = Client::findOrFail($id);

        $updateData = [
            'nom'        => $validated['nom'],
            'entreprise' => $validated['entreprise'] ?? null,
            'telephone'  => $validated['telephone']  ?? null,
            'adresse'    => $validated['adresse']    ?? null,
        ];

        // Save new avatar if provided
        if (!empty($validated['avatar'])) {
            // Delete old file
            if ($client->avatar && str_contains($client->avatar, '/uploads/avatars/')) {
                $old = public_path('uploads/avatars/' . basename($client->avatar));
                if (file_exists($old)) @unlink($old);
            }
            $base64 = $validated['avatar'];
            $data   = str_contains($base64, ',') ? explode(',', $base64)[1] : $base64;
            $dir    = public_path('uploads/avatars');
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            $filename = 'client_' . $client->id . '.jpg';
            file_put_contents($dir . '/' . $filename, base64_decode($data));
            $updateData['avatar'] = config('app.url') . '/uploads/avatars/' . $filename;
        }

        $client->update($updateData);
        $fresh = $client->fresh();

        NotificationController::notifyAdmins(
            "Client modifié : {$fresh->nom}",
            "Les informations du client {$fresh->nom} ({$fresh->email}) ont été mises à jour par {$admin->nom}.",
            'edit'
        );

        return response()->json($this->withCounts($fresh));
    }

    public function destroy(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $client    = Client::findOrFail($id);
        $nom       = $client->nom;
        $email     = $client->email;
        $isPending = !$client->is_approved;

        // Send rejection email only if this was a pending request
        if ($isPending) {
            $co = e($admin->entreprise ?: 'Intelligence Comptabilité');
            $an = e($admin->nom);
            $cn = e($nom);
            $this->sendMail(
                $email,
                $nom,
                "Votre demande n'a pas été retenue — {$co}",
                "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
                    <div style='background:linear-gradient(135deg,#B71C1C,#C62828);padding:24px;border-radius:8px;text-align:center;margin-bottom:28px;'>
                        <div style='font-size:48px;margin-bottom:8px;'>❌</div>
                        <h2 style='color:white;margin:0;font-size:22px;'>Demande non retenue</h2>
                    </div>

                    <p style='font-size:15px;color:#1e293b;'>Bonjour <strong>{$cn}</strong>,</p>

                    <p style='font-size:14px;color:#334155;line-height:1.7;'>
                        Après examen de votre dossier, nous vous informons que votre demande d'adhésion
                        à la plateforme <strong>{$co}</strong> n'a malheureusement <strong style='color:#C62828;'>pas été retenue</strong>
                        pour le moment.
                    </p>

                    <p style='font-size:14px;color:#334155;line-height:1.7;'>
                        Cette décision peut être liée à des informations manquantes ou à des critères
                        internes de la société. Nous vous encourageons à prendre contact directement
                        avec <strong>{$an}</strong> si vous souhaitez obtenir plus d'informations
                        ou soumettre une nouvelle demande.
                    </p>

                    <p style='font-size:14px;color:#334155;line-height:1.7;'>
                        Nous vous remercions de l'intérêt que vous portez à nos services et nous
                        espérons avoir l'opportunité de collaborer avec vous à l'avenir.
                    </p>

                    <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
                    <p style='color:#94a3b8;font-size:12px;text-align:center;'>
                        Intelligence Comptabilité — {$co}<br>
                        Ce message a été envoyé automatiquement, merci de ne pas y répondre.
                    </p>
                </div>"
            );
        }

        if ($client->avatar && str_contains($client->avatar, '/uploads/avatars/')) {
            $path = public_path('uploads/avatars/' . basename($client->avatar));
            if (file_exists($path)) @unlink($path);
        }

        $client->tokens()->delete();
        $client->delete();

        NotificationController::notifyAdmins(
            $isPending ? "Demande rejetée : {$nom}" : "Client supprimé : {$nom}",
            $isPending
                ? "{$admin->nom} a rejeté la demande de {$nom} ({$email}). Un email lui a été envoyé."
                : "Le compte du client {$nom} ({$email}) a été supprimé par {$admin->nom}.",
            $isPending ? 'warning' : 'delete'
        );

        return response()->json(['message' => $isPending ? 'Demande rejetée avec succès.' : 'Client supprimé avec succès.']);
    }

    public function toggleActive(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $client = Client::findOrFail($id);
        $client->update(['is_actif' => !$client->is_actif]);
        $fresh  = $client->fresh();

        $statusLabel = $fresh->is_actif ? 'activé' : 'suspendu';
        $statusType  = $fresh->is_actif ? 'success' : 'warning';
        NotificationController::notifyAdmins(
            "Statut modifié : {$fresh->nom}",
            "Le compte de {$fresh->nom} ({$fresh->email}) a été {$statusLabel} par {$admin->nom}.",
            $statusType
        );

        return response()->json($this->withCounts($fresh));
    }

    // ── Impersonation ─────────────────────────────────────────

    public function impersonate(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $client = Client::findOrFail($id);

        $adminEntreprise = trim(strtolower($admin->entreprise ?? ''));
        if ($adminEntreprise !== '' && trim(strtolower($client->entreprise ?? '')) !== $adminEntreprise) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (!$client->is_actif) {
            return response()->json(['message' => 'Ce compte client est désactivé.'], 422);
        }

        $token = $client->createToken('impersonation')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => array_merge($client->toArray(), ['role' => 'client']),
        ]);
    }

    // ── Email direct ───────────────────────────────────────────

    public function sendEmail(Request $request, int $id)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
        ]);

        $client = Client::findOrFail($id);

        try {
            Mail::send([], [], function ($mail) use ($client, $admin, $validated) {
                $mail->to($client->email, $client->nom)
                     ->subject($validated['subject'])
                     ->html(
                         '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">'
                         . '<h2 style="color:#1565C0;margin-bottom:16px;">' . e($validated['subject']) . '</h2>'
                         . '<div style="white-space:pre-line;color:#334155;line-height:1.7;">' . e($validated['message']) . '</div>'
                         . '<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">'
                         . '<p style="color:#94a3b8;font-size:12px;">Message envoyé par ' . e($admin->nom) . ' — Intelligence Comptabilité</p>'
                         . '</div>'
                     );
            });
            NotificationController::notifyAdmins(
                "Email envoyé à {$client->nom}",
                "L'administrateur {$admin->nom} a envoyé un email à {$client->nom} ({$client->email}).\nObjet : {$validated['subject']}",
                'info'
            );
            return response()->json(['message' => 'Email envoyé avec succès.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erreur envoi email : ' . $e->getMessage()], 500);
        }
    }

    // ── Invitation ─────────────────────────────────────────────

    public function invite(Request $request)
    {
        $admin = $this->adminGuard($request);
        if ($admin instanceof \Illuminate\Http\JsonResponse) return $admin;

        $validated = $request->validate(['email' => 'required|email']);
        $email     = strtolower(trim($validated['email']));
        $client    = Client::where('email', $email)->first();

        if ($client) {
            $ae = strtolower(trim($admin->entreprise  ?? ''));
            $ce = strtolower(trim($client->entreprise ?? ''));
            $sameEntreprise = $ae && $ce && $ae === $ce;

            if ($sameEntreprise) {
                $this->sendMail($client->email, $client->nom,
                    'Invitation à rejoindre ' . $admin->entreprise . ' — Intelligence Comptabilité',
                    $this->htmlInviteSameCompany($client->nom, $admin)
                );
                NotificationController::notifyAdmins(
                    "Invitation envoyée : {$client->nom}",
                    "{$admin->nom} a invité {$client->nom} ({$client->email}) à rejoindre {$admin->entreprise}.",
                    'client'
                );
                return response()->json([
                    'status'  => 'invited_same_company',
                    'message' => "Invitation envoyée à {$client->nom} ({$client->email}) — même société.",
                ]);
            }

            if ($ae && $ce) {
                $this->sendMail($client->email, $client->nom,
                    'Notification — ' . $admin->entreprise,
                    $this->htmlDifferentCompany($client->nom, $admin, $client->entreprise)
                );
                NotificationController::notifyAdmins(
                    "Notification envoyée : {$client->nom}",
                    "{$client->nom} ({$client->email}) travaille dans une autre société ({$client->entreprise}). Un email lui a été envoyé.",
                    'warning'
                );
                return response()->json([
                    'status'  => 'different_company',
                    'message' => "Email envoyé à {$client->nom} — société différente ({$client->entreprise}).",
                ]);
            }

            // No enterprise info — send generic invitation
            $this->sendMail($client->email, $client->nom,
                'Invitation — ' . ($admin->entreprise ?: 'Intelligence Comptabilité'),
                $this->htmlInviteGeneric($client->nom, $admin)
            );
            NotificationController::notifyAdmins(
                "Invitation envoyée : {$client->nom}",
                "{$admin->nom} a envoyé une invitation à {$client->nom} ({$client->email}).",
                'client'
            );
            return response()->json([
                'status'  => 'invited_existing',
                'message' => "Invitation envoyée à {$client->nom} ({$client->email}).",
            ]);
        }

        // No account yet — save pending invitation and send registration link
        ClientInvitation::updateOrCreate(
            ['admin_id' => $admin->id, 'invited_email' => $email],
            []
        );

        $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
        $link = $frontendUrl . '/register?email=' . urlencode($email);

        $this->sendMail($email, null,
            'Invitation à créer votre compte — ' . ($admin->entreprise ?: 'Intelligence Comptabilité'),
            $this->htmlRegistrationInvite($admin, $link)
        );

        NotificationController::notifyAdmins(
            "Invitation d'inscription envoyée",
            "{$admin->nom} a envoyé un lien d'inscription à {$email}. Une invitation sera automatiquement envoyée après la création de son compte.",
            'client'
        );

        return response()->json([
            'status'  => 'sent_registration',
            'message' => "Email d'inscription envoyé à {$email}. Une invitation automatique sera envoyée après son inscription.",
        ]);
    }

    // ── Private mail helpers ───────────────────────────────────

    private function sendMail(string $to, ?string $name, string $subject, string $html): void
    {
        try {
            Mail::send([], [], function ($mail) use ($to, $name, $subject, $html) {
                $m = $mail->to($to)->subject($subject)->html($html);
                if ($name) $m->to($to, $name);
            });
        } catch (\Exception $e) {
            \Log::error('ClientController mail error: ' . $e->getMessage());
        }
    }

    private function htmlInviteSameCompany(string $nom, Administrateur $admin): string
    {
        $co = e($admin->entreprise);
        $an = e($admin->nom);
        $cn = e($nom);
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
            <div style='background:#1565C0;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;'>
                <h2 style='color:white;margin:0;'>Invitation à rejoindre {$co}</h2>
            </div>
            <p>Bonjour <strong>{$cn}</strong>,</p>
            <p>Vous avez été invité(e) par <strong>{$an}</strong> à bénéficier des services de comptabilité intelligente de <strong>{$co}</strong>.</p>
            <p>Nous sommes ravis de vous compter parmi nos clients. Connectez-vous dès maintenant à votre espace client pour accéder à vos documents et déclarations fiscales.</p>
            <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
            <p style='color:#94a3b8;font-size:12px;'>Intelligence Comptabilité — message envoyé par {$an} ({$co})</p>
        </div>";
    }

    private function htmlDifferentCompany(string $nom, Administrateur $admin, ?string $clientEntreprise): string
    {
        $co  = e($admin->entreprise);
        $an  = e($admin->nom);
        $cn  = e($nom);
        $cco = e($clientEntreprise ?? 'votre société');
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
            <div style='background:#F57C00;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;'>
                <h2 style='color:white;margin:0;'>Notification de {$co}</h2>
            </div>
            <p>Bonjour <strong>{$cn}</strong>,</p>
            <p>Nous avons constaté que vous travaillez actuellement au sein de <strong>{$cco}</strong>.</p>
            <p>Si vous souhaitez tout de même bénéficier des services de <strong>{$co}</strong> ou en apprendre davantage sur notre offre, n'hésitez pas à nous contacter.</p>
            <p>Ce message vous a été adressé par <strong>{$an}</strong> de <strong>{$co}</strong>.</p>
            <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
            <p style='color:#94a3b8;font-size:12px;'>Intelligence Comptabilité</p>
        </div>";
    }

    private function htmlInviteGeneric(string $nom, Administrateur $admin): string
    {
        $co = e($admin->entreprise ?: 'Intelligence Comptabilité');
        $an = e($admin->nom);
        $cn = e($nom);
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
            <div style='background:#1565C0;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;'>
                <h2 style='color:white;margin:0;'>Invitation — {$co}</h2>
            </div>
            <p>Bonjour <strong>{$cn}</strong>,</p>
            <p><strong>{$an}</strong> vous invite à profiter des services de <strong>{$co}</strong>.</p>
            <p>Connectez-vous à votre espace client pour accéder à vos documents.</p>
            <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
            <p style='color:#94a3b8;font-size:12px;'>Intelligence Comptabilité — message envoyé par {$an}</p>
        </div>";
    }

    private function htmlRegistrationInvite(Administrateur $admin, string $link): string
    {
        $co  = e($admin->entreprise ?: 'Intelligence Comptabilité');
        $an  = e($admin->nom);
        $lnk = htmlspecialchars($link);
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;'>
            <div style='background:#1565C0;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;'>
                <h2 style='color:white;margin:0;'>Invitation à créer votre compte</h2>
            </div>
            <p>Bonjour,</p>
            <p>Vous avez été invité(e) par <strong>{$an}</strong> à utiliser la plateforme <strong>{$co}</strong> — votre solution de comptabilité intelligente.</p>
            <p>Créez votre compte gratuitement en cliquant sur le bouton ci-dessous :</p>
            <div style='text-align:center;margin:32px 0;'>
                <a href='{$lnk}' style='background:#1565C0;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;'>
                    Créer mon compte
                </a>
            </div>
            <p style='color:#64748b;font-size:13px;'>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href='{$lnk}'>{$lnk}</a></p>
            <hr style='margin:24px 0;border:none;border-top:1px solid #e2e8f0;'>
            <p style='color:#94a3b8;font-size:12px;'>Intelligence Comptabilité — message envoyé par {$an} ({$co})</p>
        </div>";
    }
}