export type StudioActionDescription = {
  kind: string;
  title: string;
  summary: string;
};

const EMAIL_KIND_LABELS: Record<string, string> = {
  credentials: 'acesso ao painel',
  'site-introduction': 'apresentação do site',
  'instagram-permission': 'permissão do Instagram',
};

const WHATSAPP_KIND_LABELS: Record<string, string> = {
  'site-introduction': 'apresentação do site',
  'instagram-permission': 'permissão do Instagram',
};

type Rule = {
  method: string;
  pattern: RegExp;
  describe: (match: RegExpMatchArray) => StudioActionDescription;
};

const RULES: Rule[] = [
  {
    method: 'POST',
    pattern: /^\/lead-discovery$/,
    describe: () => ({
      kind: 'discovery.run',
      title: 'Buscou leads',
      summary: 'Rodou discovery',
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/lead-discovery\/cache$/,
    describe: () => ({
      kind: 'discovery.cache',
      title: 'Limpou cache de discovery',
      summary: 'Removeu o cache da busca',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/enrichment\/([^/]+)\/refresh$/,
    describe: (match) => ({
      kind: 'enrichment.refresh',
      title: 'Atualizou enrichment',
      summary: `Lead ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/enrichment$/,
    describe: () => ({
      kind: 'enrichment.run',
      title: 'Rodou enrichment',
      summary: 'Enriqueceu um lead',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/account\/reset-password$/,
    describe: (match) => ({
      kind: 'account.reset',
      title: 'Resetou senha da conta',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/account\/send-password$/,
    describe: (match) => ({
      kind: 'account.send-password',
      title: 'Enviou senha da conta',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/emails\/([^/]+)$/,
    describe: (match) => ({
      kind: 'email.send',
      title: `Enviou e-mail (${emailKindLabel(match[3])})`,
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/whatsapp\/([^/]+)$/,
    describe: (match) => ({
      kind: 'whatsapp.send',
      title: `Enviou WhatsApp (${whatsappKindLabel(match[3])})`,
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/leads\/([^/]+)\/convert-to-customer$/,
    describe: (match) => ({
      kind: 'lead.convert',
      title: 'Converteu lead em customer',
      summary: `Lead ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/shares$/,
    describe: (match) => ({
      kind: 'lead.share',
      title: 'Compartilhou perfil',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/(leads|customers)\/([^/]+)\/shares\/([^/]+)$/,
    describe: (match) => ({
      kind: 'lead.unshare',
      title: 'Removeu compartilhamento',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/(leads|customers)\/([^/]+)$/,
    describe: (match) => ({
      kind: 'profile.update',
      title: `Atualizou ${ownerLabel(match[1]).toLowerCase()}`,
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/images$/,
    describe: (match) => ({
      kind: 'media.image',
      title: 'Adicionou imagem',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/(leads|customers)\/([^/]+)\/videos$/,
    describe: (match) => ({
      kind: 'media.video',
      title: 'Adicionou vídeo',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/(leads|customers)\/([^/]+)\/images\/([^/]+)$/,
    describe: (match) => ({
      kind: 'media.delete',
      title: 'Removeu imagem',
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/(leads|customers)\/([^/]+)$/,
    describe: (match) => ({
      kind: 'profile.delete',
      title: `Removeu ${ownerLabel(match[1]).toLowerCase()}`,
      summary: `${ownerLabel(match[1])} ${match[2]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/packages$/,
    describe: () => ({
      kind: 'package.create',
      title: 'Criou pacote',
      summary: 'Novo pacote da agência',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/packages\/([^/]+)$/,
    describe: (match) => ({
      kind: 'package.update',
      title: 'Atualizou pacote',
      summary: `Pacote ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/packages\/([^/]+)\/images\/([^/]+)$/,
    describe: (match) => ({
      kind: 'package.image-delete',
      title: 'Removeu mídia do pacote',
      summary: `Pacote ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/packages\/([^/]+)\/images$/,
    describe: (match) => ({
      kind: 'package.image',
      title: 'Adicionou mídia ao pacote',
      summary: `Pacote ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/packages\/([^/]+)$/,
    describe: (match) => ({
      kind: 'package.delete',
      title: 'Excluiu pacote',
      summary: `Pacote ${match[1]}`,
    }),
  },
  {
    method: 'PUT',
    pattern: /^\/config\/llm$/,
    describe: () => ({
      kind: 'config.llm',
      title: 'Atualizou configuração de LLM',
      summary: 'Salvou modelos e chaves de ambiente',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/scaffold$/,
    describe: () => ({
      kind: 'landing.scaffold',
      title: 'Gerou estrutura do site',
      summary: 'Scaffold da landing',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/prompt$/,
    describe: () => ({
      kind: 'landing.prompt',
      title: 'Gerou prompt do site',
      summary: 'Prompt da landing',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/publish$/,
    describe: () => ({
      kind: 'landing.publish',
      title: 'Publicou site',
      summary: 'Publicação da landing',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/generate$/,
    describe: () => ({
      kind: 'landing.generate',
      title: 'Gerou site',
      summary: 'Job de geração da landing',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/generations\/([^/]+)\/rating$/,
    describe: () => ({
      kind: 'landing.rating',
      title: 'Avaliou geração do site',
      summary: 'Nota na landing',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/jobs\/([^/]+)\/cancel$/,
    describe: (match) => ({
      kind: 'landing.cancel',
      title: 'Cancelou geração do site',
      summary: `Job ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/landing\/local\/([^/]+)$/,
    describe: (match) => ({
      kind: 'landing.local',
      title: 'Abriu site local',
      summary: `Lead ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/landing\/site\/([^/]+)$/,
    describe: (match) => ({
      kind: 'landing.delete',
      title: 'Removeu site',
      summary: `Lead ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/invites\/instagram-permission$/,
    describe: () => ({
      kind: 'invite.instagram',
      title: 'Enviou pedido de Instagram',
      summary: 'Convite de permissão',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/invites\/([^/]+)\/send-whatsapp$/,
    describe: (match) => ({
      kind: 'invite.whatsapp',
      title: 'Enviou convite por WhatsApp',
      summary: `Convite ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/invites$/,
    describe: () => ({
      kind: 'invite.create',
      title: 'Criou convite',
      summary: 'Novo convite',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/studio\/users$/,
    describe: () => ({
      kind: 'studio-user.invite',
      title: 'Convidou usuário do studio',
      summary: 'Enviou convite por e-mail',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/studio\/users\/([^/]+)$/,
    describe: (match) => ({
      kind: 'studio-user.update',
      title: 'Atualizou usuário do studio',
      summary: `Usuário ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/studio\/users\/([^/]+)\/reset-password$/,
    describe: (match) => ({
      kind: 'studio-user.reset',
      title: 'Resetou senha de usuário do studio',
      summary: `Usuário ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/studio\/users\/([^/]+)$/,
    describe: (match) => ({
      kind: 'studio-user.delete',
      title: 'Removeu usuário do studio',
      summary: `Usuário ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/leads\/([^/]+)\/instagram\/sync$/,
    describe: (match) => ({
      kind: 'instagram.sync',
      title: 'Sincronizou Instagram',
      summary: `Lead ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/auth\/instagram\/sync$/,
    describe: () => ({
      kind: 'instagram.sync',
      title: 'Sincronizou Instagram',
      summary: 'Conta conectada',
    }),
  },
];

export function normalizeStudioPath(path: string): string {
  const noQuery = path.split('?')[0] || '/';
  const trimmed = noQuery.replace(/\/+$/, '');
  return trimmed || '/';
}

export function shouldSkipStudioActivityPath(path: string): boolean {
  const p = normalizeStudioPath(path);
  const prefixes = ['/health', '/public', '/namao-chat', '/invite-requests'];
  if (prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    return true;
  }
  return (
    p === '/auth/studio/login' ||
    p === '/auth/studio/logout' ||
    p === '/auth/login' ||
    p === '/auth/logout' ||
    p === '/auth/register'
  );
}

export function describeStudioAction(
  method: string,
  path: string,
): StudioActionDescription {
  const verb = method.toUpperCase();
  const normalized = normalizeStudioPath(path);
  for (const rule of RULES) {
    if (rule.method !== verb) continue;
    const match = normalized.match(rule.pattern);
    if (match) return rule.describe(match);
  }
  return {
    kind: 'studio.action',
    title: 'Ação no studio',
    summary: `${verb} ${normalized}`,
  };
}

function ownerLabel(segment: string): string {
  return segment === 'customers' ? 'Customer' : 'Lead';
}

function emailKindLabel(kind: string): string {
  return EMAIL_KIND_LABELS[kind] || kind;
}

function whatsappKindLabel(kind: string): string {
  return WHATSAPP_KIND_LABELS[kind] || kind;
}
