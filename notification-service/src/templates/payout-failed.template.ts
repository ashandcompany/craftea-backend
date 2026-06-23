export interface PayoutFailedParams {
  amount: number;
  currency: string;
}

export function payoutFailedTemplate(p: PayoutFailedParams): string {
  const formatted = (p.amount / 100).toFixed(2);
  const currency = p.currency.toUpperCase();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Échec du virement - Craftea</title>
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
      --error-600: #DC2626;
      --error-50: #FEF2F2;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: var(--sage-50); font-family: 'Inter', 'Courier New', monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: var(--sage-50); padding: 48px 0;">
    <tr>
      <td align="center">
        <!-- Conteneur principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 2px solid var(--sage-300); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Header - style site avec alerte rouge -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px 24px; border-bottom: 2px solid var(--error-600);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 28px; font-weight: 300; color: var(--error-600);">⚠</span>
                <span style="font-size: 20px; font-weight: 500; color: var(--sage-600); letter-spacing: 2px; text-transform: uppercase;">Craftea</span>
                <span style="font-size: 28px; font-weight: 300; color: var(--error-600);">!</span>
              </div>
              <p style="margin: 12px 0 0 0; color: var(--error-600); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: 500;">
                ⚠ échec du virement ⚠
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <!-- Icône d'alerte -->
              <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--error-50); border-radius: 50%; border: 2px solid var(--error-600);">
                  <span style="font-size: 32px; color: var(--error-600);">⚠️</span>
                </div>
              </div>

              <!-- Message principal - alerte rouge -->
              <div style="margin-bottom: 28px; padding: 20px; background: var(--error-50); border-left: 4px solid var(--error-600);">
                <p style="margin: 0 0 8px 0; color: var(--stone-800); font-size: 16px; font-weight: 600;">
                  Nous n'avons pas pu effectuer votre virement
                </p>
                <p style="margin: 0; color: var(--error-600); font-size: 14px; line-height: 1.5;">
                  Une action est requise de votre part pour débloquer la situation.
                </p>
              </div>
              
              <!-- Montant concerné - style alerte -->
              <div style="background: var(--error-50); border: 2px solid var(--error-600); padding: 28px; text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 8px 0; color: var(--error-600); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                  montant concerné
                </p>
                <p style="margin: 0; color: var(--error-600); font-size: 42px; font-weight: 600; letter-spacing: -1px;">
                  ${formatted} ${currency}
                </p>
                <div style="margin-top: 12px;">
                  <span style="display: inline-block; width: 40px; height: 2px; background: var(--error-600);"></span>
                </div>
              </div>

              <!-- Causes possibles -->
              <div style="margin-bottom: 28px; padding: 16px; background: var(--stone-50); border: 1px solid var(--stone-200);">
                <p style="margin: 0 0 12px 0; color: var(--stone-700); font-size: 13px; font-weight: 600;">
                  🔍 Causes possibles :
                </p>
                <ul style="margin: 0; padding-left: 20px; color: var(--stone-600); font-size: 13px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Coordonnées bancaires incorrectes ou expirées</li>
                  <li style="margin-bottom: 8px;">Compte bancaire non éligible aux virements Stripe</li>
                  <li style="margin-bottom: 8px;">Problème temporaire chez votre banque</li>
                  <li>Informations d'identification manquantes ou incomplètes</li>
                </ul>
              </div>

              <!-- Séparateur décoratif -->
              <div style="margin-top: 28px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--error-600); font-size: 12px;">⚠</span>
                <span style="flex: 1; height: 1px; background: var(--error-600); opacity: 0.3;"></span>
                <span style="color: var(--error-600); font-size: 11px;">action requise</span>
                <span style="flex: 1; height: 1px; background: var(--error-600); opacity: 0.3;"></span>
                <span style="color: var(--error-600); font-size: 12px;">⚠</span>
              </div>

              <!-- Message d'action -->
              <div style="margin-top: 28px;">
                <p style="margin: 0 0 16px 0; color: var(--stone-600); font-size: 14px; line-height: 1.5;">
                  Connectez-vous à votre tableau de bord Craftea pour mettre à jour vos informations bancaires.
                </p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="#"
                     style="display: inline-block; background: var(--error-600); color: #ffffff; text-decoration: none; 
                            padding: 12px 32px; border-radius: 0px; font-size: 14px; font-weight: 500;
                            font-family: 'Inter', sans-serif; letter-spacing: 0.5px;
                            transition: all 0.2s ease; border: 2px solid var(--error-600);">
                    Mettre à jour mes infos →
                  </a>
                </div>
                <p style="margin: 16px 0 0 0; color: var(--stone-500); font-size: 12px; text-align: center;">
                  Notre équipe support est disponible si vous avez besoin d'aide :  
                  <a href="mailto:support@craftea.com" style="color: var(--error-600); text-decoration: underline;">support@craftea.com</a>
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