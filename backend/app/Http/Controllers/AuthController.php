<?php

namespace App\Http\Controllers;

use App\Mail\VerificationCodeMail;
use App\Models\Administrateur;
use App\Models\Client;
use App\Models\Notification;
use App\Models\VerificationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function sendVerificationCode(Request $request)
    {
        $request->validate([
            'email'     => 'required|email',
            'method'    => 'nullable|in:email,sms',
            'telephone' => 'nullable|string|max:20',
        ]);

        $method = $request->input('method', 'email');

        // ── SMS path ────────────────────────────────────────────
        if ($method === 'sms') {
            $telephone = preg_replace('/\s+/', '', trim($request->input('telephone', '')));
            if (!$telephone) {
                throw ValidationException::withMessages([
                    'telephone' => 'Numéro de téléphone requis pour recevoir le code par SMS.',
                ]);
            }

            // Normalise to international format
            $countryCode = env('SMS_COUNTRY_CODE', '+216');
            if (str_starts_with($telephone, '00')) {
                $telephone = '+' . substr($telephone, 2);
            } elseif (!str_starts_with($telephone, '+')) {
                $telephone = $countryCode . ltrim($telephone, '0');
            }

            $code = (string) rand(100000, 999999);

            VerificationCode::where('email', $request->email)->delete();
            VerificationCode::create([
                'email'      => $request->email,
                'code'       => $code,
                'expires_at' => now()->addMinutes(10),
            ]);

            $smsSent  = false;
            $smsError = null;
            $message  = "Votre code de vérification Intelligence Comptabilité : {$code}";

            // ── 1. Twilio ────────────────────────────────────────
            $sid   = env('TWILIO_SID');
            $token = env('TWILIO_TOKEN');
            $from  = env('TWILIO_FROM');

            if (!$smsSent && $sid && $token && $from) {
                try {
                    $res = \Illuminate\Support\Facades\Http::withBasicAuth($sid, $token)
                        ->asForm()
                        ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                            'To'   => $telephone,
                            'From' => $from,
                            'Body' => $message,
                        ]);
                    $smsSent = $res->successful();
                    if (!$smsSent) $smsError = $res->json('message') ?? 'Erreur Twilio.';
                } catch (\Exception $e) {
                    $smsError = $e->getMessage();
                }
            }

            // ── 2. Infobip (free tier — 100 SMS/month) ──────────
            $infobipKey  = env('INFOBIP_API_KEY');
            $infobipBase = env('INFOBIP_BASE_URL');

            if (!$smsSent && $infobipKey && $infobipBase) {
                try {
                    $res = \Illuminate\Support\Facades\Http::withHeaders([
                        'Authorization' => 'App ' . $infobipKey,
                        'Content-Type'  => 'application/json',
                        'Accept'        => 'application/json',
                    ])->post(rtrim($infobipBase, '/') . '/sms/2/text/advanced', [
                        'messages' => [[
                            'from'         => 'Comptabilite',
                            'destinations' => [['to' => $telephone]],
                            'text'         => $message,
                        ]],
                    ]);
                    $smsSent = $res->successful() && !empty($res->json('messages'));
                    if (!$smsSent) {
                        $smsError = $res->json('requestError.serviceException.text') ?? 'Erreur Infobip.';
                    }
                } catch (\Exception $e) {
                    $smsError = $e->getMessage();
                }
            }

            // ── 3. Vonage / Nexmo (free signup — no credit card) ─
            $vonageKey    = env('VONAGE_API_KEY');
            $vonageSecret = env('VONAGE_API_SECRET');

            if (!$smsSent && $vonageKey && $vonageSecret) {
                try {
                    $res = \Illuminate\Support\Facades\Http::post('https://rest.nexmo.com/sms/json', [
                        'api_key'    => $vonageKey,
                        'api_secret' => $vonageSecret,
                        'to'         => ltrim($telephone, '+'),
                        'from'       => env('VONAGE_FROM', 'Comptabilite'),
                        'text'       => $message,
                    ]);
                    $status  = $res->json('messages.0.status') ?? '-1';
                    $smsSent = $status === '0';
                    if (!$smsSent) {
                        $smsError = $res->json('messages.0.error-text') ?? 'Erreur Vonage.';
                    }
                } catch (\Exception $e) {
                    $smsError = $e->getMessage();
                }
            }

            // ── 4. TextBelt (last resort — 1 free SMS/day) ───────
            if (!$smsSent) {
                $textbeltKey = env('TEXTBELT_KEY', 'textbelt');
                try {
                    $res = \Illuminate\Support\Facades\Http::post('https://textbelt.com/text', [
                        'phone'   => $telephone,
                        'message' => $message,
                        'key'     => $textbeltKey,
                    ]);
                    $smsSent = $res->json('success') === true;
                    if (!$smsSent) $smsError = $res->json('error') ?? 'Erreur TextBelt.';
                } catch (\Exception $e) {
                    $smsError = $e->getMessage();
                }
            }

            return response()->json([
                'message'   => $smsSent ? "Code SMS envoyé au {$telephone}" : 'Code généré (SMS non envoyé).',
                'code'      => $smsSent ? null : $code,
                'sms_sent'  => $smsSent,
                'sms_error' => $smsError,
            ]);
        }

        // ── Email path ───────────────────────────────────────────
        // Vérifier que le domaine email existe (MX ou A record) — ignoré si DNS indisponible
        try {
            $domain = substr(strrchr($request->email, '@'), 1);
            $mxRecords = [];
            $domainExists = @getmxrr($domain, $mxRecords) || @checkdnsrr($domain, 'A');
            if (!$domainExists) {
                throw ValidationException::withMessages([
                    'email' => "L'adresse email \"" . $request->email . "\" est introuvable. Veuillez saisir une adresse email valide.",
                ]);
            }
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            // DNS check échoué — on continue quand même
        }

        $code = (string) rand(100000, 999999);

        VerificationCode::where('email', $request->email)->delete();

        VerificationCode::create([
            'email'      => $request->email,
            'code'       => $code,
            'expires_at' => now()->addMinutes(10),
        ]);

        [$emailSent, $emailError] = $this->sendVerificationEmail($request->email, $code);

        return response()->json([
            'message'    => $emailSent ? "Code envoyé sur {$request->email}" : 'Code généré (email non envoyé).',
            'code'       => $emailSent ? null : $code,
            'email_sent' => $emailSent,
            'smtp_error' => $emailSent ? null : $emailError,
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'nom'                   => 'required|string|max:100',
            'email'                 => 'required|email|max:150',
            'password'              => 'required|string|min:8|confirmed',
            'role'                  => 'required|in:admin,client',
            'entreprise'            => 'nullable|string|max:150',
            'telephone'             => 'nullable|string|max:20',
            'adresse'               => 'nullable|string|max:500',
            'code'                  => 'required|digits:6',
            'avatar'                => 'nullable|string',
        ]);

        // Vérifier le code OTP
        $record = VerificationCode::where('email', $validated['email'])
            ->where('code', $validated['code'])
            ->where('expires_at', '>', now())
            ->first();

        if (!$record) {
            throw ValidationException::withMessages([
                'code' => 'Code de vérification invalide ou expiré.',
            ]);
        }

        $record->delete();

        // Save avatar if provided
        $avatarUrl = null;
        if (!empty($validated['avatar'])) {
            $base64 = $validated['avatar'];
            $data   = str_contains($base64, ',') ? explode(',', $base64)[1] : $base64;
            $dir    = public_path('uploads/avatars');
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            $role     = $validated['role'];
            $tempName = $role . '_new_' . time() . '.jpg';
            file_put_contents($dir . '/' . $tempName, base64_decode($data));
            $avatarUrl = config('app.url') . '/uploads/avatars/' . $tempName;
        }

        if ($validated['role'] === 'admin') {
            if (Administrateur::where('email', $validated['email'])->exists()) {
                throw ValidationException::withMessages(['email' => 'Email déjà utilisé.']);
            }
            $user = Administrateur::create([
                'nom'          => $validated['nom'],
                'email'        => $validated['email'],
                'mot_de_passe' => Hash::make($validated['password']),
                'avatar'       => $avatarUrl,
            ]);
            // Rename avatar file with real ID
            if ($avatarUrl) {
                $newName = 'admin_' . $user->id . '.jpg';
                @rename(public_path('uploads/avatars/' . basename($avatarUrl)), public_path('uploads/avatars/' . $newName));
                $user->update(['avatar' => config('app.url') . '/uploads/avatars/' . $newName]);
            }
            $token = $user->createToken('auth-token')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user'  => array_merge($user->fresh()->toArray(), ['role' => 'admin']),
            ]);
        }

        if (Client::where('email', $validated['email'])->exists()) {
            throw ValidationException::withMessages(['email' => 'Email déjà utilisé.']);
        }

        // If client's entreprise matches an admin's entreprise → require approval before appearing in clients list
        $clientEntreprise = trim(strtolower($validated['entreprise'] ?? ''));
        $needsApproval = $clientEntreprise !== '' &&
            Administrateur::whereRaw('LOWER(TRIM(entreprise)) = ?', [$clientEntreprise])->exists();

        $user = Client::create([
            'nom'          => $validated['nom'],
            'email'        => $validated['email'],
            'mot_de_passe' => Hash::make($validated['password']),
            'entreprise'   => $validated['entreprise'] ?? null,
            'telephone'    => $validated['telephone']  ?? null,
            'adresse'      => $validated['adresse']    ?? null,
            'avatar'       => $avatarUrl,
            'is_approved'  => !$needsApproval,
        ]);
        // Rename avatar file with real ID
        if ($avatarUrl) {
            $newName = 'client_' . $user->id . '.jpg';
            @rename(public_path('uploads/avatars/' . basename($avatarUrl)), public_path('uploads/avatars/' . $newName));
            $user->update(['avatar' => config('app.url') . '/uploads/avatars/' . $newName]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        Notification::create([
            'client_id' => $user->id,
            'titre'     => 'Bienvenue sur la plateforme',
            'message'   => "Bonjour {$user->nom}, votre compte a été créé avec succès.",
            'type'      => 'info',
        ]);

        // Notifier les admins du nouveau client
        Notification::create([
            'client_id' => null,
            'admin_id'  => null,
            'titre'     => 'Nouveau client inscrit',
            'message'   => "Un nouveau client \"{$user->nom}\" ({$user->email}) vient de s'inscrire sur la plateforme.",
            'type'      => 'info',
        ]);

        // Send welcome email if admin had sent a pending invitation
        \App\Models\ClientInvitation::where('invited_email', $user->email)
            ->with('admin')
            ->get()
            ->each(function ($inv) use ($user) {
                $admin = $inv->admin;
                if ($admin) {
                    $co = $admin->entreprise ?: 'Intelligence Comptabilité';
                    try {
                        Mail::send([], [], function ($mail) use ($user, $admin, $co) {
                            $mail->to($user->email, $user->nom)
                                 ->subject("Bienvenue sur {$co} !")
                                 ->html(
                                     '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;">'
                                     . '<div style="background:#1565C0;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;">'
                                     . '<h2 style="color:white;margin:0;">Bienvenue sur ' . e($co) . ' !</h2></div>'
                                     . '<p>Bonjour <strong>' . e($user->nom) . '</strong>,</p>'
                                     . '<p>Votre compte a été créé avec succès. <strong>' . e($admin->nom) . '</strong> vous invite à découvrir les services de <strong>' . e($co) . '</strong>.</p>'
                                     . '<p>Connectez-vous dès maintenant pour accéder à votre espace client.</p>'
                                     . '<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">'
                                     . '<p style="color:#94a3b8;font-size:12px;">Intelligence Comptabilité — message envoyé par ' . e($admin->nom) . '</p>'
                                     . '</div>'
                                 );
                        });
                    } catch (\Exception $e) {
                        \Log::error('Welcome invite mail error: ' . $e->getMessage());
                    }
                }
                $inv->delete();
            });

        return response()->json([
            'token' => $token,
            'user'  => array_merge($user->toArray(), ['role' => 'client']),
        ]);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
            'role'     => 'nullable|in:admin,client',
        ]);

        $role = $request->input('role');

        // Toujours vérifier les deux tables — le rôle choisi est préféré en premier
        if ($role === 'admin' || !$role) {
            $admin = Administrateur::where('email', $request->email)->first();
            if ($admin && Hash::check($request->password, $admin->mot_de_passe)) {
                $token = $admin->createToken('auth-token')->plainTextToken;
                return response()->json([
                    'token' => $token,
                    'user'  => array_merge($admin->toArray(), ['role' => 'admin']),
                ]);
            }
        }

        if ($role === 'client' || !$role) {
            $client = Client::where('email', $request->email)->first();
            if ($client && Hash::check($request->password, $client->mot_de_passe)) {
                if (!$client->is_actif) {
                    throw ValidationException::withMessages(['email' => 'Compte désactivé. Contactez l\'administrateur.']);
                }
                $client->update(['last_login_at' => now()]);
                $token = $client->createToken('auth-token')->plainTextToken;
                return response()->json([
                    'token' => $token,
                    'user'  => array_merge($client->toArray(), ['role' => 'client']),
                ]);
            }
        }

        // Si role=client mais les identifiants correspondent à un admin → connexion admin
        if ($role === 'client') {
            $admin = Administrateur::where('email', $request->email)->first();
            if ($admin && Hash::check($request->password, $admin->mot_de_passe)) {
                $token = $admin->createToken('auth-token')->plainTextToken;
                return response()->json([
                    'token' => $token,
                    'user'  => array_merge($admin->toArray(), ['role' => 'admin']),
                ]);
            }
        }

        throw ValidationException::withMessages(['email' => 'Email ou mot de passe incorrect.']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'role'  => 'required|in:admin,client',
        ]);

        if ($request->role === 'admin') {
            $exists = Administrateur::where('email', $request->email)->exists();
        } else {
            $exists = Client::where('email', $request->email)->exists();
        }

        if (!$exists) {
            throw ValidationException::withMessages([
                'email' => 'Aucun compte ' . $request->role . ' trouvé avec cette adresse email.',
            ]);
        }

        $code = (string) rand(100000, 999999);

        VerificationCode::where('email', $request->email)->delete();
        VerificationCode::create([
            'email'      => $request->email,
            'code'       => $code,
            'expires_at' => now()->addMinutes(10),
        ]);

        [$emailSent] = $this->sendVerificationEmail($request->email, $code);

        return response()->json([
            'message'    => $emailSent
                ? 'Code de réinitialisation envoyé par email.'
                : 'Email non envoyé (vérifiez la configuration SMTP).',
            'email_sent' => $emailSent,
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'                 => 'required|email',
            'role'                  => 'required|in:admin,client',
            'code'                  => 'required|digits:6',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        $record = VerificationCode::where('email', $request->email)
            ->where('code', $request->code)
            ->where('expires_at', '>', now())
            ->first();

        if (!$record) {
            throw ValidationException::withMessages([
                'code' => 'Code invalide ou expiré.',
            ]);
        }

        $record->delete();

        if ($request->role === 'admin') {
            Administrateur::where('email', $request->email)
                ->update(['mot_de_passe' => Hash::make($request->password)]);
        } else {
            Client::where('email', $request->email)
                ->update(['mot_de_passe' => Hash::make($request->password)]);
        }

        // Notification à l'utilisateur
        if ($request->role === 'client') {
            $client = Client::where('email', $request->email)->first();
            if ($client) {
                Notification::create([
                    'client_id' => $client->id,
                    'titre'     => 'Mot de passe réinitialisé',
                    'message'   => 'Votre mot de passe a été réinitialisé avec succès.',
                    'type'      => 'info',
                ]);
            }
        }
        Notification::create([
            'client_id' => null,
            'admin_id'  => null,
            'titre'     => 'Mot de passe réinitialisé',
            'message'   => "Le {$request->role} ({$request->email}) a réinitialisé son mot de passe.",
            'type'      => 'alert',
        ]);

        return response()->json(['message' => 'Mot de passe réinitialisé avec succès.']);
    }

    public function logout(Request $request)
    {
        $request->user()?->tokens()->delete();
        return response()->json(['message' => 'Déconnecté.']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $role = $user instanceof Administrateur ? 'admin' : 'client';
        return response()->json(array_merge($user->toArray(), ['role' => $role]));
    }

    // ── Email helper: Brevo API first, SMTP fallback ───────────────────────
    private function sendVerificationEmail(string $toEmail, string $code): array
    {
        $apiKey = env('BREVO_API_KEY');

        // ── 1. Brevo REST API (no IP restriction) ────────────────────────
        if ($apiKey) {
            try {
                $res = \Illuminate\Support\Facades\Http::withHeaders([
                    'api-key'      => $apiKey,
                    'Content-Type' => 'application/json',
                    'Accept'       => 'application/json',
                ])->post('https://api.brevo.com/v3/smtp/email', [
                    'sender'      => [
                        'name'  => env('MAIL_FROM_NAME', 'Intelligence Comptabilité'),
                        'email' => env('MAIL_FROM_ADDRESS', 'noreply@example.com'),
                    ],
                    'to'          => [['email' => $toEmail]],
                    'subject'     => 'Votre code de vérification',
                    'htmlContent' => '
                        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
                            <h2 style="color:#1565C0;margin-bottom:8px;">Intelligence Comptabilité</h2>
                            <p style="color:#475569;">Votre code de vérification est :</p>
                            <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#0F172A;background:#F1F5F9;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">'
                                . $code .
                            '</div>
                            <p style="color:#94A3B8;font-size:13px;">Ce code expire dans 10 minutes. Ne le partagez avec personne.</p>
                        </div>',
                ]);

                if ($res->successful()) {
                    return [true, null];
                }
                $err = $res->json('message') ?? $res->body();
            } catch (\Exception $e) {
                $err = $e->getMessage();
            }
            \Log::warning('Brevo API failed: ' . ($err ?? 'unknown'));
        }

        // ── 2. SMTP fallback ─────────────────────────────────────────────
        try {
            Mail::to($toEmail)->send(new VerificationCodeMail($code));
            return [true, null];
        } catch (\Exception $e) {
            \Log::error('SMTP mail error: ' . $e->getMessage());
            return [false, $e->getMessage()];
        }
    }
}