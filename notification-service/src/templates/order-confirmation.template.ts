import { escapeHtml } from './escape.js';

export interface OrderConfirmationParams {
  orderNumber: string;
  items: {
    name: string;
    image_url?: string | null;
    qty: number;
    unitPrice: number;
  }[];
  shippingTotal?: number;
  total: number;
  commissionAmount?: number;
  orderUrl: string;
}

export function orderConfirmationTemplate(p: OrderConfirmationParams): string {
  const rows = p.items
    .map((item) => {
      const imageHtml = item.image_url
        ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; margin-right: 12px;" />`
        : '';

      return `
       <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid var(--stone-200); display: flex; align-items: center;">
          ${imageHtml}
          <span style="color: var(--stone-700); font-size: 14px;">${escapeHtml(item.name)}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid var(--stone-200); text-align: center; color: var(--stone-600); font-size: 14px;">${item.qty}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid var(--stone-200); text-align: right; color: var(--stone-700); font-size: 14px; font-weight: 500;">${(item.unitPrice / 100).toFixed(2)} €</td>
       </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmation de commande - Craftea</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
    
    /* Couleurs Sage - harmonisées avec le site */
    :root {
      --sage-50: #F8FAF5;
      --sage-100: #F0F4EA;
      --sage-200: #E5E9DE;
      --sage-300: #CBD5C0;
      --sage-400: #B0C0A2;
      --sage-500: #9AA88F;
      --sage-600: #7C8F6C;
      --sage-700: #5F6E53;
      --sage-800: #4A5A3E;
      --sage-900: #3A4732;
      --stone-50: #F8FAF5;
      --stone-100: #F1F3EF;
      --stone-200: #E5E7EB;
      --stone-300: #D6D3CD;
      --stone-400: #A8A29E;
      --stone-500: #78716C;
      --stone-600: #57534E;
      --stone-700: #44403C;
      --stone-800: #292524;
      --stone-900: #1F1E1A;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: var(--sage-50); font-family: 'Inter', 'Courier New', monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: var(--sage-50); padding: 48px 0;">
    <tr>
      <td align="center">
        <!-- Conteneur principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 2px solid var(--sage-300); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Header - style site -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px 24px; border-bottom: 2px solid var(--sage-300);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 28px; font-weight: 300; color: var(--stone-500);">✦</span>
                <span style="font-size: 20px; font-weight: 500; color: var(--sage-600); letter-spacing: 2px; text-transform: uppercase;">Craftea</span>
                <span style="font-size: 28px; font-weight: 300; color: var(--stone-500);">✦</span>
              </div>
              <p style="margin: 12px 0 0 0; color: var(--sage-500); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: 500;">
                confirmation de commande
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <!-- Message de remerciement -->
              <div style="margin-bottom: 28px; padding: 20px; background: var(--sage-50); border-left: 4px solid var(--sage-400);">
                <p style="margin: 0 0 8px 0; color: var(--stone-800); font-size: 16px; font-weight: 600;">
                  Merci pour votre commande !
                </p>
                <p style="margin: 0; color: var(--stone-600); font-size: 14px; line-height: 1.5;">
                  Nous avons bien reçu votre commande et nous la préparons avec soin.
                </p>
              </div>

              <!-- Numéro de commande -->
              <div style="margin-bottom: 28px;">
                <p style="margin: 0 0 8px 0; color: var(--sage-600); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  numéro de commande
                </p>
                <p style="margin: 0; color: var(--stone-800); font-size: 20px; font-weight: 600; font-family: monospace;">
                  #${p.orderNumber}
                </p>
              </div>

              <!-- Tableau des articles -->
              <div style="margin-bottom: 28px;">
                <p style="margin: 0 0 16px 0; color: var(--stone-700); font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                  détails de la commande
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid var(--stone-200); border-radius: 0px; overflow: hidden;">
                  <thead>
                    <tr style="background: var(--sage-50);">
                      <th style="padding: 12px 16px; text-align: left; font-size: 11px; color: var(--sage-600); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Article</th>
                      <th style="padding: 12px 16px; text-align: center; font-size: 11px; color: var(--sage-600); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Qté</th>
                      <th style="padding: 12px 16px; text-align: right; font-size: 11px; color: var(--sage-600); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Prix</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>

              <!-- Totaux -->
              <div style="margin-bottom: 32px; background: var(--sage-50); padding: 20px; border: 1px solid var(--stone-200);">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: var(--stone-600); font-size: 14px;">Frais de port payés</td>
                    <td style="padding: 8px 0; color: var(--stone-600); font-size: 14px; text-align: right;">${((p.shippingTotal ?? 0) / 100).toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 0 0; color: var(--stone-800); font-size: 16px; font-weight: 700; border-top: 2px solid var(--stone-300);">Total</td>
                    <td style="padding: 12px 0 0 0; color: var(--sage-700); font-size: 18px; font-weight: 700; text-align: right; border-top: 2px solid var(--stone-300);">${(p.total / 100).toFixed(2)} €</td>
                  </tr>
                </table>
              </div>

              <!-- Bouton principal - style site -->
              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${p.orderUrl}"
                   style="display: inline-block; background: var(--sage-700); color: #ffffff; text-decoration: none; 
                          padding: 12px 32px; border-radius: 0px; font-size: 14px; font-weight: 500;
                          font-family: 'Inter', sans-serif; letter-spacing: 0.5px;
                          transition: all 0.2s ease; border: 2px solid var(--sage-700);">
                  Voir ma commande →
                </a>
              </div>

              <!-- Informations supplémentaires -->
              <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--stone-200);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                  <span style="color: var(--sage-400); font-size: 12px;">✦</span>
                  <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                  <span style="color: var(--sage-500); font-size: 11px;">prochaines étapes</span>
                  <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                  <span style="color: var(--sage-400); font-size: 12px;">✦</span>
                </div>
                <ul style="margin: 0; padding-left: 20px; color: var(--stone-600); font-size: 13px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Confirmation de paiement reçue</li>
                  <li style="margin-bottom: 8px;">Préparation de votre commande sous 24-48h</li>
                  <li style="margin-bottom: 8px;">Expédition suivie avec numéro de suivi</li>
                  <li>Livraison estimée sous 3-5 jours ouvrés</li>
                </ul>
              </div>

              <!-- Contact -->
              <div style="margin-top: 28px; padding: 16px; background: var(--sage-50); text-align: center;">
                <p style="margin: 0; color: var(--stone-500); font-size: 12px;">
                  Une question ? Contactez-nous à 
                  <a href="mailto:support@craftea.com" style="color: var(--sage-600); text-decoration: underline;">support@craftea.com</a>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: var(--sage-50); padding: 24px 40px; border-top: 2px solid var(--sage-300);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: left;">
                    <p style="margin: 0 0 8px 0; color: var(--stone-500); font-size: 11px; font-weight: 500;">
                      © 2026 Craftea — Marché artisanal en ligne
                    </p>
                    <p style="margin: 0; color: var(--stone-400); font-size: 10px;">
                      L'artisanat authentique
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; color: var(--sage-500); font-size: 10px;">
                      v.01 — édition artisanale
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Disclaimer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; color: var(--stone-400); font-size: 11px;">
                Cet email a été généré automatiquement. Merci de ne pas y répondre.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
