import { mailFooterHtml, mailFooterText } from './mail-branding';

export function proposalEmailHtml(params: {
  name: string;
  packageName: string;
  loginUrl: string;
  logoUrl: string;
}): string {
  const name = escapeHtml(params.name || 'olá');
  const packageName = escapeHtml(params.packageName);
  const loginUrl = escapeHtml(params.loginUrl);
  const logoUrl = escapeHtml(params.logoUrl);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sua proposta — Namão Criativa</title>
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
                <p style="margin:0 0 8px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8c8c8c;">Proposta</p>
                <h1 style="margin:0 0 12px;font-family:Syne,Georgia,sans-serif;font-size:28px;line-height:1.1;letter-spacing:-0.04em;color:#f2f2f2;">Sua proposta está pronta, ${name}.</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  Preparamos o pacote <strong style="color:#f2f2f2;">${packageName}</strong> com os próximos passos, os Termos de uso e os dados da Namão.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#8c8c8c;">
                  Entre no painel para revisar e aceitar. Depois do aceite, sua conta de cliente fica liberada.
                </p>
                <p style="margin:0;text-align:center;">
                  <a href="${loginUrl}" style="display:inline-block;background:#f2f2f2;color:#050505;text-decoration:none;font-weight:700;padding:14px 22px;">Ver proposta</a>
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8c8c8c;text-align:center;">
                  Se o botão não abrir, copie: ${loginUrl}
                </p>
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

export function proposalEmailText(params: {
  name: string;
  packageName: string;
  loginUrl: string;
}): string {
  return [
    `Olá, ${params.name || 'olá'}.`,
    '',
    `Sua proposta da Namão Criativa está pronta: ${params.packageName}.`,
    '',
    'Entre no painel para ver os detalhes, os próximos passos e aceitar.',
    params.loginUrl,
    '',
    mailFooterText(),
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
