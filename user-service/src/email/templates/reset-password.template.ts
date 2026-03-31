export interface ResetPasswordParams {
  resetUrl: string;
}

export function resetPasswordTemplate(p: ResetPasswordParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Réinitialisation du mot de passe - Craftea</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background: #f5f3ef; font-family: 'Courier New', 'SF Mono', 'Fira Code', 'Inter', monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f3ef; padding: 48px 0;">
     <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 2px solid #CBD5C0; box-shadow: 4px 4px 0 rgba(139, 115, 85, 0.05);">
          
          <!-- Header style machine à écrire -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px 24px; border-bottom: 2px solid #CBD5C0;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 28px; font-weight: 300; color: #6B5E4A;">{</span>
                <span style="font-size: 20px; font-weight: 500; color: #7C8F6C; letter-spacing: 2px; text-transform: uppercase;">Craftea</span>
                <span style="font-size: 28px; font-weight: 300; color: #6B5E4A;">}</span>
              </div>
              <p style="margin: 12px 0 0 0; color: #9AA88F; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-family: monospace;">
                &gt; RÉINITIALISATION DU MOT DE PASSE
              </p>
            </td>
          </tr>
          
          <!-- Content style terminal -->
          <tr>
            <td style="padding: 32px 40px;">
              <div style="margin-bottom: 24px; padding: 16px; background: #F8FAF5; border-left: 4px solid #CBD5C0;">
                <p style="margin: 0 0 8px 0; color: #1F1E1A; font-size: 14px; font-family: monospace; line-height: 1.5;">
                  Vous avez demandé à réinitialiser votre mot de passe.
                </p>
                <p style="margin: 0; color: #78716C; font-size: 12px; font-family: monospace;">
                  Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                </p>
              </div>
              
              <div style="margin-bottom: 24px; padding: 12px 16px; background: #FFF8EB; border: 1px solid #FDE68A;">
                <p style="margin: 0; color: #B45309; font-size: 10px; font-family: monospace; letter-spacing: 0.5px;">
                  ⚠ CE LIEN EST VALABLE <strong>1 HEURE</strong>
                </p>
                <p style="margin: 8px 0 0 0; color: #78716C; font-size: 11px; font-family: monospace;">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                </p>
              </div>
              
              <!-- Button style machine à écrire -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${p.resetUrl}"
                   style="display: inline-block; background: #ffffff; color: #7C8F6C; text-decoration: none; 
                          padding: 12px 32px; border: 2px solid #CBD5C0; font-size: 13px; font-weight: 500;
                          font-family: monospace; letter-spacing: 1px; text-transform: uppercase;
                          transition: all 0.2s ease; cursor: pointer;">
                  [ RÉINITIALISER ]
                </a>
                <p style="margin: 12px 0 0 0; color: #9AA88F; font-size: 9px; font-family: monospace;">
                  ▸ appuyez sur [entrée] pour confirmer
                </p>
              </div>
              
              <!-- Lien de secours style terminal -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px dashed #E5E7EB;">
                <p style="margin: 0 0 8px 0; color: #78716C; font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.5px;">
                  [ lien de secours ]
                </p>
                <p style="margin: 0; color: #9AA88F; font-size: 10px; font-family: monospace; word-break: break-all; background: #F8FAF5; padding: 8px; border: 1px solid #E5E7EB;">
                  ${p.resetUrl}
                </p>
                <p style="margin: 8px 0 0 0; color: #CBD5C0; font-size: 8px; font-family: monospace;">
                  &gt; copiez et collez dans votre navigateur
                </p>
              </div>
              
              <!-- Effet machine à écrire -->
              <div style="margin-top: 32px; display: flex; align-items: center; gap: 8px;">
                <span style="color: #CBD5C0; font-size: 12px;">///</span>
                <span style="color: #9AA88F; font-size: 9px; font-family: monospace;">commande sécurisée</span>
                <span style="flex: 1;"></span>
                <span style="color: #CBD5C0; font-size: 12px;">⏎</span>
              </div>
            </td>
          </tr>
          
          <!-- Footer style machine à écrire -->
          <tr>
            <td style="background: #F8FAF5; padding: 20px 40px; border-top: 2px solid #CBD5C0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: left;">
                    <p style="margin: 0 0 4px 0; color: #78716C; font-size: 10px; font-family: monospace;">
                      © 2024 Craftea — Marché artisanal en ligne
                    </p>
                    <p style="margin: 0; color: #CBD5C0; font-size: 8px; font-family: monospace;">
                      [ code: RESET_PWD_${Math.random().toString(36).substring(2, 6).toUpperCase()} ]
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; color: #9AA88F; font-size: 9px; font-family: monospace;">
                      version 1.0
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Disclaimer style terminal -->
        <table width="560" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; color: #CBD5C0; font-size: 9px; font-family: monospace;">
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