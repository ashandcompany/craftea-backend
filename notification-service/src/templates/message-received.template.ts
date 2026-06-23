import { escapeHtml } from './escape.js';

export interface MessageReceivedParams {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}

export function messageReceivedTemplate(p: MessageReceivedParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nouveau message - Craftea</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600&display=swap');
    :root {
      --sage-50: #F8FAF5; --sage-100: #F0F4EA; --sage-200: #E5E9DE;
      --sage-300: #CBD5C0; --sage-400: #B0C0A2; --sage-500: #9AA88F;
      --sage-600: #7C8F6C; --sage-700: #5F6E53; --sage-800: #4A5A3E;
      --stone-200: #E5E7EB; --stone-400: #A8A29E; --stone-500: #78716C;
      --stone-600: #57534E; --stone-700: #44403C; --stone-800: #292524;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: var(--sage-50); font-family: 'Inter', 'Courier New', monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: var(--sage-50); padding: 48px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 2px solid var(--sage-300);">

          <!-- Header -->
          <tr>
            <td style="background: #ffffff; padding: 28px 40px 20px; border-bottom: 2px solid var(--sage-300);">
              <div>
                <span style="font-size: 28px; font-weight: 300; color: var(--stone-400);">✦</span>
                <span style="font-size: 18px; font-weight: 500; color: var(--sage-600); letter-spacing: 2px; text-transform: uppercase; margin: 0 10px;">Craftea</span>
                <span style="font-size: 28px; font-weight: 300; color: var(--stone-400);">✦</span>
              </div>
              <p style="margin: 10px 0 0 0; color: var(--sage-500); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: 500;">
                nouveau message
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">

              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; color: var(--stone-700); font-size: 15px; font-weight: 500;">
                Bonjour ${escapeHtml(p.recipientName)},
              </p>
              <p style="margin: 0 0 24px 0; color: var(--stone-600); font-size: 14px; line-height: 1.6;">
                <strong style="color: var(--stone-800);">${escapeHtml(p.senderName)}</strong>
                vous a envoyé un message sur Craftea.
              </p>

              <!-- Message preview -->
              <div style="margin: 0 0 28px 0; padding: 16px 20px; background: var(--sage-50); border-left: 3px solid var(--sage-400);">
                <p style="margin: 0 0 6px 0; color: var(--sage-600); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  aperçu du message
                </p>
                <p style="margin: 0; color: var(--stone-700); font-size: 14px; line-height: 1.6; font-style: italic;">
                  « ${escapeHtml(p.messagePreview)} »
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 28px 0 20px;">
                <a href="${p.conversationUrl}"
                   style="display: inline-block; background: var(--sage-700); color: #ffffff; text-decoration: none;
                          padding: 12px 36px; font-size: 14px; font-weight: 500;
                          font-family: 'Inter', sans-serif; letter-spacing: 0.5px; border: 2px solid var(--sage-700);">
                  Voir le message →
                </a>
              </div>

              <p style="margin: 20px 0 0 0; color: var(--stone-400); font-size: 12px; text-align: center; line-height: 1.5;">
                Vous pouvez aussi répondre directement depuis votre espace<br>
                <a href="${p.conversationUrl}" style="color: var(--sage-600); text-decoration: underline;">Mes messages</a> sur Craftea.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: var(--sage-50); padding: 20px 40px; border-top: 2px solid var(--sage-300);">
              <p style="margin: 0; color: var(--stone-500); font-size: 11px; font-weight: 500;">
                © 2026 Craftea — Marché artisanal en ligne
              </p>
              <p style="margin: 6px 0 0 0; color: var(--stone-400); font-size: 10px;">
                Vous recevez cet email car un utilisateur vous a envoyé un message sur Craftea.
              </p>
            </td>
          </tr>

        </table>

        <!-- Disclaimer -->
        <table width="560" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
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
