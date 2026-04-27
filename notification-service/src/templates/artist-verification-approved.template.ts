export interface ArtistVerificationApprovedParams {
  artistName: string;
}

export function artistVerificationApprovedTemplate(
  p: ArtistVerificationApprovedParams,
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Compte artiste validé - Craftea</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF5;font-family:'Inter','Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF5;padding:48px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #CBD5C0;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #CBD5C0;">
            <span style="font-size:20px;font-weight:500;color:#7C8F6C;letter-spacing:2px;text-transform:uppercase;">Craftea</span>
            <p style="margin:12px 0 0;color:#059669;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
              compte artiste validé ✓
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#44403C;">Bonjour ${p.artistName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              Félicitations ! Votre compte artiste Craftea a été <strong>validé</strong>. Vos œuvres ainsi que votre profil sont désormais visibles sur la plateforme.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              Vous pouvez dès maintenant finaliser votre boutique, ajouter vos produits et commencer à vendre.
            </p>
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
