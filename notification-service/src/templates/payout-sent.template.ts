export interface PayoutSentParams {
  amount: number;
  currency: string;
  estimatedDays: number;
}

export function payoutSentTemplate(p: PayoutSentParams): string {
  const formatted = (p.amount / 100).toFixed(2);
  const currency = p.currency.toUpperCase();

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
            <td style="background:#2563eb;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Craftea</h1>
              <p style="margin:4px 0 0;color:#dbeafe;font-size:14px;">Virement initié</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 24px;color:#374151;font-size:16px;">
                Votre virement a été initié avec succès.
              </p>
              <!-- Amount highlight -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:#3b82f6;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Montant viré</p>
                <p style="margin:0;color:#1d4ed8;font-size:32px;font-weight:700;">${formatted} ${currency}</p>
              </div>
              <p style="margin:0;color:#6b7280;font-size:14px;">
                Les fonds devraient apparaître sur votre compte bancaire dans
                <strong>${p.estimatedDays} jour${p.estimatedDays > 1 ? 's' : ''} ouvré${p.estimatedDays > 1 ? 's' : ''}</strong>.
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
