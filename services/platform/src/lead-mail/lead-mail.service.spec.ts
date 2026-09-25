import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadMailService } from './lead-mail.service';

describe('LeadMailService', () => {
  const prisma = {
    lead: { findUnique: jest.fn() },
    clientAccount: { findFirst: jest.fn() },
  };
  const config = { get: jest.fn() };
  const invites = {
    sendInstagramPermission: jest.fn(),
    sendSiteIntroduction: jest.fn(),
    namaoWhatsApp: jest.fn(),
  };
  const accounts = { getAccount: jest.fn(), sendPassword: jest.fn() };
  const activity = { record: jest.fn() };
  const owners = {
    kindOf: jest.fn().mockResolvedValue('lead'),
    requireKind: jest.fn().mockResolvedValue('lead'),
    findProfile: jest.fn(),
  };
  const packages = {
    findActive: jest.fn(),
    requireActive: jest.fn(),
    getOfferTemplate: jest.fn(),
  };
  const mailer = { sendPackageOffer: jest.fn(), sendProposal: jest.fn() };
  const proposals = { upsertFromSend: jest.fn() };
  const service = new LeadMailService(
    prisma as never,
    config as never,
    invites as never,
    accounts as never,
    activity as never,
    owners as never,
    packages as never,
    mailer as never,
    proposals as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5174');
    accounts.getAccount.mockResolvedValue({
      email: 'ana@loja.com',
      canEmail: true,
      loginUrl: 'http://localhost:5174/login.html',
    });
    invites.namaoWhatsApp.mockReturnValue('+5519997306695');
    prisma.clientAccount.findFirst.mockResolvedValue({ email: 'ana@loja.com' });
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'contato@firma.com',
      publishedOrigin: 'https://firma.vercel.app',
      clientAccounts: [],
      instagramConnections: [],
    });
    packages.findActive.mockResolvedValue([]);
    owners.kindOf.mockResolvedValue('lead');
  });

  it('lista os modelos disponíveis', async () => {
    const result = await service.list('lead-1');
    expect(result.items.map((item) => item.id)).toEqual([
      'site-introduction',
      'instagram-permission',
      'credentials',
      'package-offer',
      'proposal',
    ]);
    expect(result.items[0].available).toBe(true);
    expect(result.items[0].to).toBe('contato@firma.com');
    expect(result.items[1].available).toBe(true);
    expect(result.items[2].available).toBe(true);
    expect(result.items[3].available).toBe(false);
    expect(result.items[3].unavailableReason).toMatch(/pacote ativo/i);
  });

  it('marca pedido de Instagram indisponível se já conectou', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'contato@firma.com',
      publishedOrigin: 'https://firma.vercel.app',
      clientAccounts: [],
      instagramConnections: [{ username: 'firma.lab' }],
    });
    const result = await service.list('lead-1');
    const instagram = result.items.find((item) => item.id === 'instagram-permission');
    expect(instagram?.available).toBe(false);
    expect(instagram?.unavailableReason).toContain('@firma.lab');
  });

  it('preview do Instagram devolve html e assunto', async () => {
    const preview = await service.preview('lead-1', 'instagram-permission');
    expect(preview.subject).toContain('Instagram');
    expect(preview.html).toContain('Firma');
    expect(preview.to).toBe('contato@firma.com');
    expect(preview.canSend).toBe(true);
  });

  it('lista apresentação do site indisponível sem URL da Vercel', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'contato@firma.com',
      publishedOrigin: null,
      clientAccounts: [],
      instagramConnections: [],
    });
    const result = await service.list('lead-1');
    const intro = result.items.find((item) => item.id === 'site-introduction');
    expect(intro?.available).toBe(false);
    expect(intro?.unavailableReason).toMatch(/Vercel/i);
  });

  it('preview da apresentação inclui site, cadastro e WhatsApp', async () => {
    const preview = await service.preview('lead-1', 'site-introduction');
    expect(preview.subject).toMatch(/site profissional/i);
    expect(preview.html).toContain('https://firma.vercel.app');
    expect(preview.html).toContain('Completar cadastro');
    expect(preview.html).toContain('wa.me/5519997306695');
    expect(preview.html).toContain('Google Meu Negócio');
    expect(preview.to).toBe('contato@firma.com');
    expect(preview.canSend).toBe(true);
  });

  it('preview da apresentação funciona sem site publicado, mas não permite enviar', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'contato@firma.com',
      publishedOrigin: null,
      clientAccounts: [],
      instagramConnections: [],
    });
    const preview = await service.preview('lead-1', 'site-introduction');
    expect(preview.html).toContain('Firma');
    expect(preview.html).not.toContain('Ver o site');
    expect(preview.canSend).toBe(false);
    expect(preview.notice).toMatch(/Vercel/i);
  });

  it('preview de acesso avisa que a senha é gerada no envio', async () => {
    const preview = await service.preview('lead-1', 'credentials');
    expect(preview.html).toContain('••••••••');
    expect(preview.notice).toMatch(/senha/i);
    expect(preview.canSend).toBe(true);
  });

  it('preview do Instagram funciona sem e-mail, mas não permite enviar', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: null,
      clientAccounts: [],
      instagramConnections: [],
    });
    const preview = await service.preview('lead-1', 'instagram-permission');
    expect(preview.html).toContain('Firma');
    expect(preview.to).toBe('—');
    expect(preview.canSend).toBe(false);
    expect(preview.notice).toMatch(/e-mail válido/i);
  });

  it('preview de acesso funciona com login interno, mas não permite enviar', async () => {
    accounts.getAccount.mockResolvedValue({
      email: 'lead+acct@clientes.namao.local',
      canEmail: false,
      loginUrl: 'http://localhost:5174/login.html',
    });
    const preview = await service.preview('lead-1', 'credentials');
    expect(preview.html).toContain('••••••••');
    expect(preview.to).toBe('—');
    expect(preview.canSend).toBe(false);
    expect(preview.notice).toMatch(/e-mail válido/i);
  });

  it('envia o pedido de Instagram pelo serviço de convites', async () => {
    invites.sendInstagramPermission.mockResolvedValue({
      sent: true,
      to: 'contato@firma.com',
    });
    await service.send('lead-1', 'instagram-permission');
    expect(invites.sendInstagramPermission).toHaveBeenCalledWith('lead-1');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        channel: 'email',
        kind: 'instagram-permission',
        summary: 'Enviado para contato@firma.com',
      }),
    );
  });

  it('envia a apresentação do site pelo serviço de convites', async () => {
    invites.sendSiteIntroduction.mockResolvedValue({
      sent: true,
      to: 'contato@firma.com',
    });
    await service.send('lead-1', 'site-introduction');
    expect(invites.sendSiteIntroduction).toHaveBeenCalledWith('lead-1');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'site-introduction',
        title: 'E-mail enviado: Apresentação do site',
      }),
    );
  });

  it('não grava histórico se o Instagram já está autorizado', async () => {
    invites.sendInstagramPermission.mockResolvedValue({
      sent: false,
      alreadyConnected: true,
      username: 'firma.lab',
    });
    await service.send('lead-1', 'instagram-permission');
    expect(activity.record).not.toHaveBeenCalled();
  });

  it('recusa modelo desconhecido', async () => {
    await expect(service.preview('lead-1', 'promo')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404 se o lead não existe', async () => {
    owners.kindOf.mockResolvedValue(null);
    await expect(service.list('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lista enviar pacote quando há pacote ativo', async () => {
    packages.findActive.mockResolvedValue([
      { id: 'pkg-1', name: 'Site', price: 1200, promoPrice: 800, currency: 'BRL' },
    ]);
    const result = await service.list('lead-1');
    const offer = result.items.find((item) => item.id === 'package-offer');
    expect(offer?.available).toBe(true);
    expect(offer?.packages).toHaveLength(1);
  });

  it('preview da proposta interpola o pacote', async () => {
    packages.requireActive.mockResolvedValue({
      id: 'pkg-1',
      name: 'Site Estratégico',
      summary: 'Presença digital',
      description: 'Site completo',
      benefits: ['Google'],
      price: 1200,
      promoPrice: 800,
      currency: 'BRL',
      status: 'active',
    });
    packages.getOfferTemplate.mockResolvedValue({
      emailSubject: '{{package.name}} para {{lead.name}}',
      emailBody: '{{package.priceLine}}\n{{package.benefits}}',
      whatsappMessage: '',
    });
    const preview = await service.preview('lead-1', 'package-offer', 'pkg-1');
    expect(preview.subject).toContain('Site Estratégico');
    expect(preview.html).toContain('de ');
    expect(preview.html).toContain('• Google');
    expect(preview.canSend).toBe(true);
    expect(preview.packageId).toBe('pkg-1');
  });

  it('recusa preview de proposta sem pacote', async () => {
    packages.requireActive.mockRejectedValue(
      new BadRequestException('Selecione um pacote para enviar a proposta.'),
    );
    await expect(service.preview('lead-1', 'package-offer')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('envia a proposta pelo mailer', async () => {
    packages.requireActive.mockResolvedValue({
      id: 'pkg-1',
      name: 'Site Estratégico',
      summary: 'Presença',
      description: null,
      benefits: [],
      price: 1200,
      promoPrice: null,
      currency: 'BRL',
      status: 'active',
    });
    packages.getOfferTemplate.mockResolvedValue({
      emailSubject: 'Proposta',
      emailBody: 'Olá, {{lead.name}}',
      whatsappMessage: '',
    });
    mailer.sendPackageOffer.mockResolvedValue(undefined);
    const result = await service.send('lead-1', 'package-offer', 'pkg-1');
    expect(mailer.sendPackageOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'contato@firma.com',
        subject: 'Proposta',
      }),
    );
    expect(result).toMatchObject({ sent: true, to: 'contato@firma.com', packageId: 'pkg-1' });
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'package-offer',
        channel: 'email',
      }),
    );
  });

  it('envia o link da proposta e persiste o pacote', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'contato@firma.com',
      publishedOrigin: 'https://firma.vercel.app',
      clientAccounts: [{ email: 'ana@loja.com' }],
      instagramConnections: [],
    });
    packages.requireActive.mockResolvedValue({
      id: 'pkg-1',
      name: 'Site Estratégico',
    });
    mailer.sendProposal.mockResolvedValue(undefined);
    proposals.upsertFromSend.mockResolvedValue({});
    const result = await service.send('lead-1', 'proposal', 'pkg-1');
    expect(proposals.upsertFromSend).toHaveBeenCalledWith('lead-1', 'pkg-1');
    expect(mailer.sendProposal).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'contato@firma.com' }),
    );
    expect(result).toMatchObject({ sent: true, packageId: 'pkg-1' });
  });
});
