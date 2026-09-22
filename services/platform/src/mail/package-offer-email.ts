import { mailFooterHtml, mailFooterText } from './mail-branding';

export function packageOfferEmailHtml(params: {
  heading: string;
  body: string;
  logoUrl: string;
}): string {
  const heading = escapeHtml(params.heading || 'Proposta');
  const logoUrl = escapeHtml(params.logoUrl);
  const body = bodyToHtml(params.body);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading} — Namão Criativa</title>
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
                <h1 style="margin:0 0 16px;font-family:Syne,Georgia,sans-serif;font-size:28px;line-height:1.1;letter-spacing:-0.04em;color:#f2f2f2;">${heading}</h1>
                ${body}
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

export function packageOfferEmailText(params: { body: string }): string {
  return [params.body.trim(), '', mailFooterText()].join('\n');
}

function bodyToHtml(value: string): string {
  const blocks = value
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) {
    return '<p style="margin:0;font-size:15px;line-height:1.55;color:#8c8c8c;"> </p>';
  }
  return blocks
    .map((block, index) => {
      const html = escapeHtml(block).replace(/\n/g, '<br />');
      const margin = index === blocks.length - 1 ? '0' : '0 0 16px';
      return `<p style="margin:${margin};font-size:15px;line-height:1.55;color:#8c8c8c;">${html}</p>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
