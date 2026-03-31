export interface StripeKycConfirmedParams {
  artistName: string;
}

export function stripeKycConfirmedTemplate(p: StripeKycConfirmedParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#059669;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Craftea</h1>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:14px;">Identité vérifiée avec succès</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <!-- Success icon -->
              <div style="width:56px;height:56px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 0 24px;text-align:center;line-height:56px;font-size:28px;">
                ✓
              </div>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">
                Bonjour <strong>${p.artistName}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">
                Bonne nouvelle ! Votre identité a été <strong style="color:#059669;">vérifiée avec succès</strong> par Stripe.
              </p>
              <p style="margin:0 0 0;color:#374151;font-size:15px;">
                Vous pouvez maintenant recevoir des paiements directement sur votre compte bancaire. Les virements seront déclenchés automatiquement après chaque vente.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
