import { escapeHtml } from './escape.js';

export interface StripeKycConfirmedParams {
  artistName: string;
}

export function stripeKycConfirmedTemplate(p: StripeKycConfirmedParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Identité vérifiée - Craftea</title>
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
      --success-600: #059669;
      --success-50: #F0FDF4;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: var(--sage-50); font-family: 'Inter', 'Courier New', monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: var(--sage-50); padding: 48px 0;">
    <tr>
      <td align="center">
        <!-- Conteneur principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 2px solid var(--sage-300); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Header - style site avec succès -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px 24px; border-bottom: 2px solid var(--sage-300);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 28px; font-weight: 300; color: var(--sage-600);">✓</span>
                <span style="font-size: 20px; font-weight: 500; color: var(--sage-600); letter-spacing: 2px; text-transform: uppercase;">Craftea</span>
                <span style="font-size: 28px; font-weight: 300; color: var(--sage-600);">✦</span>
              </div>
              <p style="margin: 12px 0 0 0; color: #059669; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: 500;">
                identité vérifiée ✓
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <!-- Icône de succès -->
              <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: #F0FDF4; border-radius: 50%;">
                  <span style="font-size: 32px; color: #059669;">✓</span>
                </div>
              </div>

              <!-- Message principal -->
              <div style="margin-bottom: 28px; padding: 20px; background: #F0FDF4; border-left: 4px solid #059669;">
                <p style="margin: 0 0 8px 0; color: var(--stone-800); font-size: 16px; font-weight: 600;">
                  Félicitations ${escapeHtml(p.artistName)} !
                </p>
                <p style="margin: 0; color: var(--stone-600); font-size: 14px; line-height: 1.5;">
                  Votre identité a été <strong style="color: #059669;">vérifiée avec succès</strong> par notre partenaire de paiement.
                </p>
              </div>

              <!-- Informations importantes -->
              <div style="margin-bottom: 28px; padding: 16px; background: var(--sage-50); border: 1px solid var(--sage-300);">
                <p style="margin: 0 0 12px 0; color: var(--stone-700); font-size: 13px; font-weight: 500;">
                  ✅ Vous pouvez maintenant :
                </p>
                <ul style="margin: 0; padding-left: 20px; color: var(--stone-600); font-size: 13px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Recevoir des paiements directement sur votre compte bancaire</li>
                  <li style="margin-bottom: 8px;">Voir vos ventes et transactions dans votre tableau de bord</li>
                  <li>Bénéficier de virements automatiques après chaque vente</li>
                </ul>
              </div>

              <!-- Séparateur décoratif -->
              <div style="margin-top: 28px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--sage-400); font-size: 12px;">✦</span>
                <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                <span style="color: #059669; font-size: 11px;">prêt à vendre</span>
                <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                <span style="color: var(--sage-400); font-size: 12px;">✦</span>
              </div>

              <!-- Message de bienvenue -->
              <div style="margin-top: 28px; text-align: center;">
                <p style="margin: 0; color: var(--stone-500); font-size: 13px;">
                  Nous avons hâte de découvrir vos créations !
                </p>
                <p style="margin: 12px 0 0 0; color: var(--stone-400); font-size: 11px;">
                  Commencez à publier vos produits et recevez vos premiers paiements
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
                      © 2024 Craftea — Marché artisanal en ligne
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