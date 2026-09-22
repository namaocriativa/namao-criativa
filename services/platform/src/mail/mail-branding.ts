export const MAIL_SITE_URL = 'https://namaocriativa.com.br';
export const MAIL_CONTACT = 'contato@namaocriativa.com.br';

export function mailFooterHtml(): string {
  return `Você recebeu este e-mail porque tem conta, convite ou projeto com a Namão Criativa.<br />Namão Criativa · <a href="${MAIL_SITE_URL}" style="color:#8c8c8c;text-decoration:underline;">namaocriativa.com.br</a><br />Dúvidas: <a href="mailto:${MAIL_CONTACT}" style="color:#8c8c8c;text-decoration:underline;">${MAIL_CONTACT}</a>`;
}

export function mailFooterText(): string {
  return [
    'Você recebeu este e-mail porque tem conta, convite ou projeto com a Namão Criativa.',
    `Namão Criativa · ${MAIL_SITE_URL}`,
    `Dúvidas: ${MAIL_CONTACT}`,
  ].join('\n');
}
