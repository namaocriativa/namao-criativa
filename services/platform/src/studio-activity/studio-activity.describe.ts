export type StudioActionDescription = {
  kind: string;
  title: string;
  summary: string;
};

const EMAIL_KIND_LABELS: Record<string, string> = {
  credentials: 'acesso ao painel',
  'site-introduction': 'apresentação do site',
  'instagram-permission': 'permissão do Instagram',
  'package-offer': 'proposta de pacote',
};

const WHATSAPP_KIND_LABELS: Record<string, string> = {
  'site-introduction': 'apresentação do site',
  'instagram-permission': 'permissão do Instagram',
  credentials: 'acesso ao painel',
  'package-offer': 'proposta de pacote',
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
    method: 'POST',
    pattern: /^\/calendar\/posts$/,
    describe: () => ({
      kind: 'calendar.post.create',
      title: 'Criou post no calendário',
      summary: 'Novo conteúdo agendado',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/calendar\/posts\/([^/]+)$/,
    describe: (match) => ({
      kind: 'calendar.post.update',
      title: 'Atualizou post do calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/calendar\/posts\/([^/]+)\/assets\/([^/]+)$/,
    describe: (match) => ({
      kind: 'calendar.asset.delete',
      title: 'Removeu mídia do calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/calendar\/posts\/([^/]+)\/assets\/from-studio$/,
    describe: (match) => ({
      kind: 'calendar.asset.studio',
      title: 'Anexou mídia do studio ao calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/calendar\/posts\/([^/]+)\/assets$/,
    describe: (match) => ({
      kind: 'calendar.asset.upload',
      title: 'Enviou mídia ao calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/calendar\/posts\/([^/]+)\/schedule$/,
    describe: (match) => ({
      kind: 'calendar.post.schedule',
      title: 'Agendou post',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/calendar\/posts\/([^/]+)\/publish$/,
    describe: (match) => ({
      kind: 'calendar.post.publish',
      title: 'Publicou post do calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/calendar\/posts\/([^/]+)\/targets\/([^/]+)\/mark-published$/,
    describe: (match) => ({
      kind: 'calendar.target.published',
      title: 'Marcou plataforma como publicada',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/calendar\/posts\/([^/]+)$/,
    describe: (match) => ({
      kind: 'calendar.post.delete',
      title: 'Excluiu post do calendário',
      summary: `Post ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/turns$/,
    describe: () => ({
      kind: 'creative.llm.turn',
      title: 'Enviou mensagem no Studio Criativo',
      summary: 'Turno do chat livre',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/conversations$/,
    describe: () => ({
      kind: 'creative.llm.conversation',
      title: 'Criou conversa no Studio Criativo',
      summary: 'Nova conversa',
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/conversations\/([^/]+)\/turns$/,
    describe: (match) => ({
      kind: 'creative.llm.turn',
      title: 'Enviou mensagem no Studio Criativo',
      summary: `Conversa ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/tools\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.llm.tool',
      title: 'Executou tool do Studio Criativo',
      summary: match[1],
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/creative\/llm\/conversations\/([^/]+)\/proposals\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.llm.proposal-edit',
      title: 'Editou proposta de geração',
      summary: `Conversa ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/conversations\/([^/]+)\/proposals\/([^/]+)\/confirm$/,
    describe: (match) => ({
      kind: 'creative.llm.confirm',
      title: 'Confirmou geração no Studio Criativo',
      summary: `Conversa ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/llm\/conversations\/([^/]+)\/proposals\/([^/]+)\/cancel$/,
    describe: (match) => ({
      kind: 'creative.llm.cancel',
      title: 'Cancelou proposta de geração',
      summary: `Conversa ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/features\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind:
        match[1] === 'flyer-venda-landing'
          ? 'creative.flyer-venda.generate'
          : 'creative.feature.generate',
      title:
        match[1] === 'flyer-venda-landing'
          ? 'Gerou flyer de venda'
          : `Gerou ${match[1]}`,
      summary: `Feature ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/characters$/,
    describe: () => ({
      kind: 'creative.character.create',
      title: 'Criou personagem',
      summary: 'Nova identidade no Studio Criativo',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/creative\/characters\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.character.update',
      title: 'Atualizou personagem',
      summary: `Personagem ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/creative\/characters\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.character.delete',
      title: 'Excluiu personagem',
      summary: `Personagem ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/characters\/([^/]+)\/photos$/,
    describe: (match) => ({
      kind: 'creative.character.photo',
      title: 'Gerou foto do personagem',
      summary: `Personagem ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/characters\/([^/]+)\/videos$/,
    describe: (match) => ({
      kind: 'creative.character.video',
      title: 'Gerou vídeo do personagem',
      summary: `Personagem ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/movies$/,
    describe: () => ({
      kind: 'creative.movie.create',
      title: 'Criou filme',
      summary: 'Novo storyboard no Studio Criativo',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/creative\/movies\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.movie.update',
      title: 'Atualizou filme',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/creative\/movies\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.movie.delete',
      title: 'Excluiu filme',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/movies\/([^/]+)\/shots$/,
    describe: (match) => ({
      kind: 'creative.movie.shot.create',
      title: 'Adicionou take',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/creative\/movies\/([^/]+)\/shots\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.movie.shot.update',
      title: 'Atualizou take',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/creative\/movies\/([^/]+)\/shots\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.movie.shot.delete',
      title: 'Removeu take',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/movies\/([^/]+)\/shots\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind: 'creative.movie.shot.generate',
      title: 'Gerou take do filme',
      summary: `Filme ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/inicio-fim$/,
    describe: () => ({
      kind: 'creative.start-end.create',
      title: 'Gerou clipe início e fim',
      summary: 'Novo clipe no Studio Criativo',
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/creative\/inicio-fim\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.start-end.delete',
      title: 'Excluiu clipe início e fim',
      summary: `Clipe ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/inicio-fim\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind: 'creative.start-end.generate',
      title: 'Gerou clipe início e fim',
      summary: `Clipe ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/ugc-skills$/,
    describe: () => ({
      kind: 'creative.ugc.create',
      title: 'Gerou clipe UGC Skills',
      summary: 'Novo anúncio no Studio Criativo',
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/creative\/ugc-skills\/([^/]+)$/,
    describe: (match) => ({
      kind: 'creative.ugc.delete',
      title: 'Excluiu clipe UGC Skills',
      summary: `Clipe ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/creative\/ugc-skills\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind: 'creative.ugc.generate',
      title: 'Gerou clipe UGC Skills',
      summary: `Clipe ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/image-projects$/,
    describe: () => ({
      kind: 'image-project.create',
      title: 'Criou projeto de imagens',
      summary: 'Novo projeto no studio de imagens',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/image-projects\/([^/]+)$/,
    describe: (match) => ({
      kind: 'image-project.update',
      title: 'Atualizou projeto de imagens',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/image-projects\/([^/]+)\/assets\/([^/]+)$/,
    describe: (match) => ({
      kind: 'image-project.asset-delete',
      title: 'Removeu imagem do projeto',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/image-projects\/([^/]+)\/references$/,
    describe: (match) => ({
      kind: 'image-project.reference',
      title: 'Adicionou referência ao projeto',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/image-projects\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind: 'image-project.generate',
      title: 'Gerou imagem',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/image-projects\/([^/]+)$/,
    describe: (match) => ({
      kind: 'image-project.delete',
      title: 'Excluiu projeto de imagens',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/video-projects$/,
    describe: () => ({
      kind: 'video-project.create',
      title: 'Criou projeto de vídeos',
      summary: 'Novo projeto no studio de vídeos',
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/video-projects\/([^/]+)$/,
    describe: (match) => ({
      kind: 'video-project.update',
      title: 'Atualizou projeto de vídeos',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/video-projects\/([^/]+)\/assets\/([^/]+)$/,
    describe: (match) => ({
      kind: 'video-project.asset-delete',
      title: 'Removeu arquivo do projeto de vídeos',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/video-projects\/([^/]+)\/frames$/,
    describe: (match) => ({
      kind: 'video-project.frame',
      title: 'Adicionou quadro ao projeto de vídeos',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'POST',
    pattern: /^\/video-projects\/([^/]+)\/generate$/,
    describe: (match) => ({
      kind: 'video-project.generate',
      title: 'Gerou vídeo',
      summary: `Projeto ${match[1]}`,
    }),
  },
  {
    method: 'DELETE',
    pattern: /^\/video-projects\/([^/]+)$/,
    describe: (match) => ({
      kind: 'video-project.delete',
      title: 'Excluiu projeto de vídeos',
      summary: `Projeto ${match[1]}`,
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
    p === '/auth/admin/login' ||
    p === '/auth/admin/logout' ||
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
