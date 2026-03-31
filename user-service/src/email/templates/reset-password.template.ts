export interface ResetPasswordParams {
  resetUrl: string;
}

export function resetPasswordTemplate(p: ResetPasswordParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <tr>
            <td style="background:#7c3aed;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Craftea</h1>
              <p style="margin:4px 0 0;color:#ede9fe;font-size:14px;">Réinitialisation du mot de passe</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
              </p>
              <p style="margin:0 0 32px;color:#6b7280;font-size:14px;">
                Ce lien est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
              </p>
              <a href="${p.resetUrl}"
                 style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">
                Réinitialiser mon mot de passe
              </a>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;">
                Ou copiez ce lien : ${p.resetUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f3f4f6;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">© Craftea — Marché artisanal en ligne</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
