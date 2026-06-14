import { escapeHtml } from './escape.js';

export interface StripeKycInviteParams {
  artistName: string;
  onboardingUrl: string;
}

export function stripeKycInviteTemplate(p: StripeKycInviteParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vérification d'identité - Craftea</title>
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
                vérification d'identité
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <!-- Message principal -->
              <div style="margin-bottom: 28px; padding: 20px; background: var(--sage-50); border-left: 4px solid var(--sage-400);">
                <p style="margin: 0 0 8px 0; color: var(--stone-800); font-size: 16px; font-weight: 600;">
                  Bonjour ${escapeHtml(p.artistName)},
                </p>
                <p style="margin: 0; color: var(--stone-600); font-size: 14px; line-height: 1.5;">
                  Pour commencer à recevoir des paiements sur Craftea, nous devons vérifier votre identité via notre partenaire de paiement sécurisé.
                </p>
              </div>

              <!-- Informations importantes -->
              <div style="margin-bottom: 28px; padding: 16px; background: #FFFBEB; border: 1px solid #FDE68A;">
                <p style="margin: 0 0 8px 0; color: #B45309; font-size: 12px; font-weight: 500;">
                  ⚡ À savoir
                </p>
                <p style="margin: 0; color: var(--stone-600); font-size: 13px; line-height: 1.5;">
                  Cette étape est obligatoire et ne prend que quelques minutes. Vos informations sont transmises de manière chiffrée et sécurisée.
                </p>
              </div>

              <!-- Bouton principal - style site -->
              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${p.onboardingUrl}"
                   style="display: inline-block; background: var(--sage-700); color: #ffffff; text-decoration: none; 
                          padding: 12px 32px; border-radius: 0px; font-size: 14px; font-weight: 500;
                          font-family: 'Inter', sans-serif; letter-spacing: 0.5px;
                          transition: all 0.2s ease; border: 2px solid var(--sage-700);">
                  Vérifier mon identité →
                </a>
              </div>

              <!-- Séparateur décoratif -->
              <div style="margin-top: 32px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--sage-400); font-size: 12px;">✦</span>
                <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                <span style="color: var(--sage-500); font-size: 11px;">paiements sécurisés</span>
                <span style="flex: 1; height: 1px; background: var(--stone-200);"></span>
                <span style="color: var(--sage-400); font-size: 12px;">✦</span>
              </div>

              <!-- Informations Stripe -->
              <div style="margin-top: 28px; padding: 16px; background: var(--sage-50); text-align: center;">
                <p style="margin: 0; color: var(--stone-500); font-size: 11px;">
                  🔒 Paiements sécurisés par Stripe
                </p>
                <p style="margin: 8px 0 0 0; color: var(--stone-400); font-size: 10px;">
                  Les fonds sont versés directement sur votre compte bancaire après chaque vente
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