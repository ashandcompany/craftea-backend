export interface OrderConfirmationParams {
  orderNumber: string;
  items: { name: string; qty: number; unitPrice: number }[];
  total: number;
  commissionAmount: number;
  orderUrl: string;
}

export function orderConfirmationTemplate(p: OrderConfirmationParams): string {
  const rows = p.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${(item.unitPrice / 100).toFixed(2)} €</td>
      </tr>`,
    )
    .join('');

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
            <td style="background:#7c3aed;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Craftea</h1>
              <p style="margin:4px 0 0;color:#ede9fe;font-size:14px;">Confirmation de commande</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 24px;color:#374151;font-size:16px;">
                Merci pour votre commande ! Voici le récapitulatif.
              </p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">
                Commande n°
              </p>
              <p style="margin:0 0 24px;color:#111827;font-size:18px;font-weight:700;">${p.orderNumber}</p>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Article</th>
                    <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Qté</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">Prix</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;">Commission plateforme</td>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;text-align:right;">${(p.commissionAmount / 100).toFixed(2)} €</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0;color:#111827;font-size:16px;font-weight:700;border-top:2px solid #e5e7eb;">Total</td>
                  <td style="padding:8px 0 0;color:#111827;font-size:16px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">${(p.total / 100).toFixed(2)} €</td>
                </tr>
              </table>

              <a href="${p.orderUrl}"
                 style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">
                Voir ma commande
              </a>
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
