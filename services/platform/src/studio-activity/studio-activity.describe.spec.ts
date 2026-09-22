import {
  describeStudioAction,
  shouldSkipStudioActivityPath,
} from './studio-activity.describe';

describe('describeStudioAction', () => {
  it('traduz discovery e enrichment', () => {
    expect(describeStudioAction('POST', '/enrichment')).toEqual({
      kind: 'enrichment.run',
      title: 'Rodou enrichment',
      summary: 'Enriqueceu um lead',
    });
    expect(describeStudioAction('POST', '/lead-discovery')).toMatchObject({
      kind: 'discovery.run',
      title: 'Buscou leads',
    });
  });

  it('traduz envio de e-mail com o kind', () => {
    expect(
      describeStudioAction('POST', '/leads/abc/emails/site-introduction'),
    ).toEqual({
      kind: 'email.send',
      title: 'Enviou e-mail (apresentação do site)',
      summary: 'Lead abc',
    });
    expect(
      describeStudioAction('POST', '/leads/abc/emails/package-offer'),
    ).toEqual({
      kind: 'email.send',
      title: 'Enviou e-mail (proposta de pacote)',
      summary: 'Lead abc',
    });
    expect(describeStudioAction('POST', '/leads/abc/shares')).toEqual({
      kind: 'lead.share',
      title: 'Compartilhou perfil',
      summary: 'Lead abc',
    });
    expect(describeStudioAction('DELETE', '/customers/abc/shares/u1')).toEqual({
      kind: 'lead.unshare',
      title: 'Removeu compartilhamento',
      summary: 'Customer abc',
    });
  });

  it('ignora chat público, health e login', () => {
    expect(shouldSkipStudioActivityPath('/health')).toBe(true);
    expect(shouldSkipStudioActivityPath('/public/chat/session')).toBe(true);
    expect(shouldSkipStudioActivityPath('/auth/studio/login')).toBe(true);
    expect(shouldSkipStudioActivityPath('/auth/admin/login')).toBe(true);
    expect(shouldSkipStudioActivityPath('/auth/admin/logout')).toBe(true);
    expect(shouldSkipStudioActivityPath('/enrichment')).toBe(false);
  });

  it('traduz projetos de imagens', () => {
    expect(describeStudioAction('POST', '/image-projects')).toEqual({
      kind: 'image-project.create',
      title: 'Criou projeto de imagens',
      summary: 'Novo projeto no studio de imagens',
    });
    expect(
      describeStudioAction('POST', '/image-projects/abc/generate'),
    ).toEqual({
      kind: 'image-project.generate',
      title: 'Gerou imagem',
      summary: 'Projeto abc',
    });
  });

  it('traduz projetos de vídeos', () => {
    expect(describeStudioAction('POST', '/video-projects')).toEqual({
      kind: 'video-project.create',
      title: 'Criou projeto de vídeos',
      summary: 'Novo projeto no studio de vídeos',
    });
    expect(
      describeStudioAction('POST', '/video-projects/abc/generate'),
    ).toEqual({
      kind: 'video-project.generate',
      title: 'Gerou vídeo',
      summary: 'Projeto abc',
    });
  });

  it('traduz o agente do Studio Criativo', () => {
    expect(describeStudioAction('POST', '/creative/llm/turns')).toEqual({
      kind: 'creative.llm.turn',
      title: 'Enviou mensagem no Studio Criativo',
      summary: 'Turno do chat livre',
    });
    expect(
      describeStudioAction(
        'POST',
        '/creative/llm/conversations/abc/proposals/p1/confirm',
      ),
    ).toEqual({
      kind: 'creative.llm.confirm',
      title: 'Confirmou geração no Studio Criativo',
      summary: 'Conversa abc',
    });
  });

  it('traduz geração do Studio Criativo', () => {
    expect(
      describeStudioAction(
        'POST',
        '/creative/features/flyer-venda-landing/generate',
      ),
    ).toEqual({
      kind: 'creative.flyer-venda.generate',
      title: 'Gerou flyer de venda',
      summary: 'Feature flyer-venda-landing',
    });
    expect(
      describeStudioAction('POST', '/creative/characters'),
    ).toEqual({
      kind: 'creative.character.create',
      title: 'Criou personagem',
      summary: 'Nova identidade no Studio Criativo',
    });
    expect(
      describeStudioAction('POST', '/creative/characters/abc/photos'),
    ).toEqual({
      kind: 'creative.character.photo',
      title: 'Gerou foto do personagem',
      summary: 'Personagem abc',
    });
    expect(describeStudioAction('POST', '/creative/movies')).toEqual({
      kind: 'creative.movie.create',
      title: 'Criou filme',
      summary: 'Novo storyboard no Studio Criativo',
    });
    expect(
      describeStudioAction('POST', '/creative/movies/abc/shots/s1/generate'),
    ).toEqual({
      kind: 'creative.movie.shot.generate',
      title: 'Gerou take do filme',
      summary: 'Filme abc',
    });
    expect(describeStudioAction('POST', '/creative/inicio-fim')).toEqual({
      kind: 'creative.start-end.create',
      title: 'Gerou clipe início e fim',
      summary: 'Novo clipe no Studio Criativo',
    });
    expect(
      describeStudioAction('POST', '/creative/inicio-fim/abc/generate'),
    ).toEqual({
      kind: 'creative.start-end.generate',
      title: 'Gerou clipe início e fim',
      summary: 'Clipe abc',
    });
    expect(describeStudioAction('POST', '/creative/ugc-skills')).toEqual({
      kind: 'creative.ugc.create',
      title: 'Gerou clipe UGC Skills',
      summary: 'Novo anúncio no Studio Criativo',
    });
    expect(
      describeStudioAction('POST', '/creative/ugc-skills/abc/generate'),
    ).toEqual({
      kind: 'creative.ugc.generate',
      title: 'Gerou clipe UGC Skills',
      summary: 'Clipe abc',
    });
  });

  it('traduz o calendário de conteúdo', () => {
    expect(describeStudioAction('POST', '/calendar/posts')).toEqual({
      kind: 'calendar.post.create',
      title: 'Criou post no calendário',
      summary: 'Novo conteúdo agendado',
    });
    expect(
      describeStudioAction('POST', '/calendar/posts/abc/publish'),
    ).toEqual({
      kind: 'calendar.post.publish',
      title: 'Publicou post do calendário',
      summary: 'Post abc',
    });
  });
});
