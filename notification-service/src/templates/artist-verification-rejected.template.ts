export interface ArtistVerificationRejectedParams {
  artistName: string;
  note?: string | null;
}

export function artistVerificationRejectedTemplate(
  p: ArtistVerificationRejectedParams,
): string {
  const noteBlock = p.note
    ? `<div style="background:#FEF3C7;border-left:4px solid #D97706;padding:16px 20px;margin:24px 0;">
        <p style="margin:0;font-size:14px;color:#92400E;font-weight:600;">Motif du refus</p>
        <p style="margin:8px 0 0;font-size:14px;color:#78350F;line-height:1.6;">${p.note}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demande de validation refusée - Craftea</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF5;font-family:'Inter','Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF5;padding:48px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #CBD5C0;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #CBD5C0;">
            <span style="font-size:20px;font-weight:500;color:#7C8F6C;letter-spacing:2px;text-transform:uppercase;">Craftea</span>
            <p style="margin:12px 0 0;color:#DC2626;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
              demande de validation refusée
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#44403C;">Bonjour ${p.artistName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              Après examen de votre dossier, votre demande de validation de compte artiste n'a pas été acceptée pour le moment.
            </p>
            ${noteBlock}
            <p style="margin:0 0 24px;font-size:15px;color:#44403C;line-height:1.6;">
              Vous pouvez soumettre une nouvelle demande avec des documents complémentaires depuis votre espace artiste.
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
