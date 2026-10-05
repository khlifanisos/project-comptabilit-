<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class NotificationController extends Controller
{
    /**
     * Visibility rule for an admin: a notification targeted specifically at
     * them (admin_id = their id), or a cabinet-wide broadcast
     * (admin_id AND client_id both null, from notifyAdmins()). Never another
     * admin's targeted notification.
     */
    private function adminVisibilityQuery(Administrateur $admin)
    {
        return Notification::where(function ($q) use ($admin) {
            $q->where('admin_id', $admin->id)
              ->orWhere(function ($q2) { $q2->whereNull('admin_id')->whereNull('client_id'); });
        });
    }

    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $notifications = $this->adminVisibilityQuery($user)->latest()->take(50)->get();
        } else {
            $notifications = Notification::where('client_id', $user->id)
                ->latest()->take(50)->get();
        }

        return response()->json($notifications);
    }

    public function markRead(Request $request, int $id)
    {
        $notification = $this->visible($request, $id);
        $notification->update(['lu' => true]);
        return response()->json($notification);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $this->adminVisibilityQuery($user)->update(['lu' => true]);
        } else {
            Notification::where('client_id', $user->id)->update(['lu' => true]);
        }

        return response()->json(['message' => 'Toutes les notifications marquées comme lues.']);
    }

    public function destroy(Request $request, int $id)
    {
        $this->visible($request, $id)->delete();
        return response()->json(['message' => 'Notification supprimée.']);
    }

    public function destroyAll(Request $request)
    {
        $user = $request->user();

        if ($user instanceof Administrateur) {
            $this->adminVisibilityQuery($user)->delete();
        } else {
            Notification::where('client_id', $user->id)->delete();
        }

        return response()->json(['message' => 'Toutes les notifications supprimées.']);
    }

    /** Fetches a notification by id, 404ing if it isn't one the caller may see. */
    private function visible(Request $request, int $id): Notification
    {
        $user = $request->user();
        $notification = Notification::findOrFail($id);

        $allowed = $user instanceof Administrateur
            ? ($notification->admin_id === $user->id || ($notification->admin_id === null && $notification->client_id === null))
            : $notification->client_id === $user->id;

        if (!$allowed) {
            abort(404);
        }
        return $notification;
    }

    // Notification visible par tous les admins (client_id=null, admin_id=null)
    public static function notifyAdmins(string $titre, string $message, string $type = 'info'): void
    {
        Notification::create([
            'client_id' => null,
            'admin_id'  => null,
            'titre'     => $titre,
            'message'   => $message,
            'type'      => $type,
        ]);
    }

    // Notification visible uniquement par CET admin (ex: ticket qui lui est assigné)
    public static function notifyAdmin(int $adminId, string $titre, string $message, string $type = 'info'): void
    {
        Notification::create([
            'client_id' => null,
            'admin_id'  => $adminId,
            'titre'     => $titre,
            'message'   => $message,
            'type'      => $type,
        ]);
    }

    public static function sendAndNotify(int $clientId, string $titre, string $message, string $type = 'info'): void
    {
        $notification = Notification::create([
            'client_id' => $clientId,
            'titre'     => $titre,
            'message'   => $message,
            'type'      => $type,
        ]);

        $client = \App\Models\Client::find($clientId);
        if (!$client) return;

        try {
            Mail::html(self::buildEmailHtml($titre, $message, $client->nom), function ($mail) use ($client, $titre) {
                $mail->to($client->email, $client->nom)
                     ->subject("[Intelligence Comptabilité] {$titre}");
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Notification email failed: ' . $e->getMessage());
        }
    }

    private static function buildEmailHtml(string $titre, string $message, string $nom): string
    {
        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
        <tr>
          <td style="background:linear-gradient(135deg,#1565C0,#0D47A1);padding:32px;text-align:center">
            <h1 style="color:white;margin:0;font-size:22px;font-weight:800">Intelligence Comptabilité</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Plateforme de gestion comptable</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px">
            <p style="font-size:15px;color:#555;margin:0 0 12px">Bonjour <strong>{$nom}</strong>,</p>
            <div style="background:#e3f0ff;border-left:4px solid #1565C0;padding:20px;border-radius:8px;margin:20px 0">
              <h2 style="color:#1565C0;margin:0 0 8px;font-size:17px">{$titre}</h2>
              <p style="color:#333;margin:0;font-size:14px;line-height:1.6">{$message}</p>
            </div>
            <p style="font-size:13px;color:#888;margin:20px 0 0">
              Connectez-vous à votre espace pour plus de détails.
            </p>
            <div style="text-align:center;margin:24px 0">
              <a href="http://localhost:3000/dashboard"
                 style="background:linear-gradient(135deg,#1565C0,#0D47A1);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                Accéder à mon espace
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9ff;padding:20px 32px;text-align:center;border-top:1px solid #e8eaf6">
            <p style="color:#aaa;font-size:12px;margin:0">
              © 2026 Intelligence Comptabilité — Cet email est automatique, merci de ne pas y répondre.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
