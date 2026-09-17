<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de vérification</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:32px;text-align:center;">
              <div style="width:56px;height:56px;background:linear-gradient(135deg,#FF6F00,#FF8F00);border-radius:12px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
                <span style="color:white;font-size:28px;font-weight:900;">&#9650;</span>
              </div>
              <h1 style="color:white;margin:0;font-size:22px;font-weight:800;">Intelligence Comptabilité</h1>
              <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">Vérification de votre adresse email</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Bonjour,<br><br>
                Voici votre code de vérification pour créer votre compte sur la plateforme <strong>Intelligence Comptabilité</strong>.
              </p>

              <!-- Code box -->
              <div style="text-align:center;margin:32px 0;">
                <div style="display:inline-block;background:#f0f4ff;border:2px dashed #1565C0;border-radius:12px;padding:24px 48px;">
                  <p style="margin:0 0 8px;color:#1565C0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Votre code</p>
                  <p style="margin:0;color:#0D47A1;font-size:42px;font-weight:900;letter-spacing:12px;">{{ $code }}</p>
                </div>
              </div>

              <p style="color:#666;font-size:13px;text-align:center;margin:0 0 32px;">
                ⏱ Ce code est valable pendant <strong>10 minutes</strong>.
              </p>

              <div style="background:#fff8e1;border-left:4px solid #FF6F00;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;color:#E65100;font-size:13px;">
                  ⚠️ Si vous n'avez pas demandé ce code, ignorez cet email.
                </p>
              </div>

              <p style="color:#999;font-size:12px;text-align:center;margin:0;">
                © 2026 Intelligence Comptabilité — Tous droits réservés
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>