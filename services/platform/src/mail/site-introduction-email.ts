import { mailFooterHtml, mailFooterText } from './mail-branding';

export function namaoWhatsAppUrl(
  phone: string | null | undefined,
  leadName: string,
  message?: string,
): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const who = leadName?.trim() || 'meu negócio';
  const text =
    message?.trim() ||
    `Olá! Sou responsável pela ${who}. Vi o site que a Namão montou e quero conversar.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function siteIntroductionEmailHtml(params: {
  name: string;
  siteUrl: string | null;
  registerUrl: string;
  whatsappUrl: string | null;
  logoUrl: string;
  hasAccount: boolean;
}): string {
  const name = escapeHtml(params.name || 'olá');
  const logoUrl = escapeHtml(params.logoUrl);
  const registerUrl = escapeHtml(params.registerUrl);
  const registerCta = params.hasAccount
    ? 'Entrar no painel'
    : 'Completar cadastro';
  const registerHint = params.hasAccount
    ? 'Com o acesso você acompanha o projeto e as próximas etapas.'
    : 'Leva um minuto. Com o cadastro você acompanha o projeto e libera as próximas etapas.';
  const siteBlock = params.siteUrl
    ? siteCtaBlock(params.siteUrl)
    : '';
  const whatsappBlock = params.whatsappUrl
    ? whatsappCtaBlock(params.whatsappUrl)
    : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seu site profissional — Namão Criativa</title>
  </head>
  <body style="margin:0;padding:0;background:#050505;color:#f2f2f2;font-family:Figtree,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 0 28px;text-align:center;">
                <img src="${logoUrl}" alt="Namão Criativa" width="180" style="display:inline-block;width:180px;max-width:70%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(255,255,255,0.12);padding:32px 28px 28px;">
                <p style="margin:0 0 8px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8c8c8c;">Primeiro contato</p>
                <h1 style="margin:0 0 12px;font-family:Syne,Georgia,sans-serif;font-size:28px;line-height:1.1;letter-spacing:-0.04em;color:#f2f2f2;">${name}, o site do seu negócio já está pronto.</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  Somos a Namão Criativa. Montamos uma presença digital profissional para apresentar o que você faz, receber contatos e passar confiança — sem você precisar começar do zero.
                </p>
                ${siteBlock}
                <p style="margin:28px 0 8px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8c8c8c;">Posicionamento no Google</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  Além do site, a gente cuida para o cliente te encontrar quando procurar o que você oferece:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="padding:0 0 10px;font-size:14px;line-height:1.5;color:#f2f2f2;">Google Meu Negócio — ficha, fotos e avaliações no mapa.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px;font-size:14px;line-height:1.5;color:#f2f2f2;">Busca local — aparecer quando alguém pesquisa perto de você.</td>
                  </tr>
                  <tr>
                    <td style="padding:0;font-size:14px;line-height:1.5;color:#f2f2f2;">Conteúdo no site pensado para o Google, não só para ficar bonito.</td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  ${escapeHtml(registerHint)}
                </p>
                <p style="margin:0;text-align:center;">
                  <a href="${registerUrl}" style="display:inline-block;background:#f2f2f2;color:#050505;text-decoration:none;font-weight:700;padding:14px 22px;">${escapeHtml(registerCta)}</a>
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8c8c8c;text-align:center;">
                  Se o botão não abrir, copie: ${registerUrl}
                </p>
                ${whatsappBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 8px 0;text-align:center;font-size:12px;color:#8c8c8c;">
                ${mailFooterHtml()}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function siteIntroductionEmailText(params: {
  name: string;
  siteUrl: string | null;
  registerUrl: string;
  whatsappUrl: string | null;
  hasAccount: boolean;
}): string {
  const registerCta = params.hasAccount
    ? 'Entrar no painel'
    : 'Completar cadastro';
  const lines = [
    `Olá ${params.name || ''}`.trim() + ',',
    '',
    'Somos a Namão Criativa. Montamos um site profissional para o seu negócio — presença digital pronta para apresentar o que você faz e receber contatos.',
  ];
  if (params.siteUrl) {
    lines.push('', `Ver o site: ${params.siteUrl}`);
  }
  lines.push(
    '',
    'Além do site, cuidamos do posicionamento no Google: Google Meu Negócio, busca local e conteúdo para o cliente te encontrar.',
    '',
    `${registerCta}: ${params.registerUrl}`,
  );
  if (params.whatsappUrl) {
    lines.push('', `Falar no WhatsApp: ${params.whatsappUrl}`);
  }
  lines.push('', mailFooterText());
  return lines.join('\n');
}

function siteCtaBlock(siteUrl: string): string {
  const href = escapeHtml(siteUrl);
  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(255,255,255,0.12);margin:0 0 8px;">
                  <tr>
                    <td style="padding:18px 20px 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8c8c8c;font-family:'IBM Plex Mono',ui-monospace,monospace;">Seu site</td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 18px;font-size:14px;line-height:1.5;color:#f2f2f2;word-break:break-all;">${href}</td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;text-align:center;">
                  <a href="${href}" style="display:inline-block;background:#f2f2f2;color:#050505;text-decoration:none;font-weight:700;padding:14px 22px;">Ver o site</a>
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8c8c8c;text-align:center;">
                  Se o botão não abrir, copie: ${href}
                </p>`;
}

function whatsappCtaBlock(whatsappUrl: string): string {
  const href = escapeHtml(whatsappUrl);
  return `
                <p style="margin:28px 0 12px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  Prefere falar agora? Chama a gente no WhatsApp.
                </p>
                <p style="margin:0;text-align:center;">
                  <a href="${href}" style="display:inline-block;border:1px solid #f2f2f2;color:#f2f2f2;text-decoration:none;font-weight:700;padding:14px 22px;">Falar no WhatsApp</a>
                </p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
