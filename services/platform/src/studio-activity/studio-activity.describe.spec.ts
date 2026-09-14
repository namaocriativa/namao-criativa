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
    expect(shouldSkipStudioActivityPath('/enrichment')).toBe(false);
  });
});
