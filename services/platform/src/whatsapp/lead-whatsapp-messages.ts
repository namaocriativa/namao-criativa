export const PREVIEW_PASSWORD = '••••••••';
export const PREVIEW_INVITE_TOKEN = 'preview';

export function siteIntroductionWhatsApp(params: {
  name: string;
  siteUrl: string | null;
  registerUrl: string;
  hasAccount: boolean;
}): string {
  const registerCta = params.hasAccount
    ? 'Entrar no painel'
    : 'Completar cadastro';
  const lines = [
    `Olá, ${params.name || 'olá'}.`,
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
    '',
    'Namão Criativa',
  );
  return lines.join('\n');
}

export function instagramPermissionWhatsApp(params: {
  name: string;
  actionUrl: string;
  hasAccount: boolean;
}): string {
  const nextStep = params.hasAccount
    ? 'Entre no painel e autorize o Instagram para liberarmos as mídias do perfil.'
    : 'Crie sua conta no link abaixo e, em seguida, autorize o Instagram.';
  return [
    `Olá, ${params.name || 'olá'}.`,
    '',
    'Podemos usar fotos e vídeos do seu Instagram no material digital do seu negócio?',
    nextStep,
    '',
    params.actionUrl,
    '',
    'Namão Criativa',
  ].join('\n');
}

export function credentialsWhatsApp(params: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return [
    `Olá, ${params.name || 'olá'}.`,
    '',
    'Seu acesso à Namão Criativa:',
    `E-mail: ${params.email}`,
    `Senha: ${params.password}`,
    '',
    `Entrar: ${params.loginUrl}`,
    '',
    'Namão Criativa',
  ].join('\n');
}

export function applyWhatsAppPlaceholders(
  text: string,
  replacements: Array<[string, string]>,
): string {
  let next = text;
  for (const [from, to] of replacements) {
    if (!from || from === to) continue;
    next = next.split(from).join(to);
  }
  return next;
}
