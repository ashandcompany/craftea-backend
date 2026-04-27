export interface ArtistVerificationSubmittedParams {
  artistName: string;
  artistId: number;
}

export function artistVerificationSubmittedTemplate(
  p: ArtistVerificationSubmittedParams,
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nouvelle demande de validation artiste - Craftea</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF5;font-family:'Inter','Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF5;padding:48px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #CBD5C0;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #CBD5C0;">
            <span style="font-size:20px;font-weight:500;color:#7C8F6C;letter-spacing:2px;text-transform:uppercase;">Craftea</span>
            <p style="margin:12px 0 0;color:#92400e;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
              nouvelle demande de validation artiste
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#44403C;">Bonjour,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              L'artiste <strong>${p.artistName}</strong> (ID&nbsp;: #${p.artistId}) vient de soumettre des documents de preuve de création pour la validation de son compte.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              Rendez-vous dans l'espace d'administration pour examiner les documents soumis et approuver ou refuser la demande.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background:#7C8F6C;padding:14px 28px;">
                  <a href="{{ADMIN_URL}}/account/admin/artists" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                    Examiner la demande →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:2px solid #E5E9DE;background:#F8FAF5;">
            <p style="margin:0;font-size:12px;color:#78716C;">Craftea — Notification automatique</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
