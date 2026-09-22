import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LeadWhatsAppService } from './lead-whatsapp.service';

describe('LeadWhatsAppService', () => {
  const prisma = {
    lead: { findUnique: jest.fn() },
    clientAccount: { findFirst: jest.fn() },
  };
  const config = { get: jest.fn() };
  const evolution = {
    configured: jest.fn(),
    sendText: jest.fn(),
  };
  const invites = { create: jest.fn() };
  const accounts = { resetPassword: jest.fn() };
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
  const service = new LeadWhatsAppService(
    prisma as never,
    config as never,
    evolution as never,
    invites as never,
    accounts as never,
    activity as never,
    owners as never,
    packages as never,
  );

  const lead = {
    id: 'lead-1',
    name: 'Firma',
    phone: '11999999999',
    whatsapp: '+5511999999999',
    publishedOrigin: 'https://firma.vercel.app',
    clientAccounts: [],
    instagramConnections: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5174');
    evolution.configured.mockReturnValue(true);
    prisma.lead.findUnique.mockResolvedValue({ ...lead });
    prisma.clientAccount.findFirst.mockResolvedValue({ id: 'user-1' });
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
    ]);
    expect(result.items[0].available).toBe(true);
    expect(result.items[0].to).toBe('+5511999999999');
    expect(result.items[1].available).toBe(true);
    expect(result.items[2].available).toBe(true);
  });

  it('marca apresentação indisponível sem site publicado', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      publishedOrigin: null,
    });
    const result = await service.list('lead-1');
    const intro = result.items.find((item) => item.id === 'site-introduction');
    expect(intro?.available).toBe(false);
    expect(intro?.unavailableReason).toMatch(/Vercel/i);
  });

  it('marca todos indisponíveis sem Evolution', async () => {
    evolution.configured.mockReturnValue(false);
    const result = await service.list('lead-1');
    expect(result.items.every((item) => item.available === false)).toBe(true);
    expect(result.items[0].unavailableReason).toMatch(/Evolution/i);
  });

  it('marca todos indisponíveis sem telefone', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      phone: null,
      whatsapp: null,
    });
    const result = await service.list('lead-1');
    expect(result.items.every((item) => item.available === false)).toBe(true);
    expect(result.items[0].unavailableReason).toMatch(/WhatsApp ou telefone/i);
  });

  it('preview da apresentação inclui site e cadastro', async () => {
    const preview = await service.preview('lead-1', 'site-introduction');
    expect(preview.text).toContain('https://firma.vercel.app');
    expect(preview.text).toContain('invite=preview');
    expect(preview.to).toBe('+5511999999999');
    expect(preview.canSend).toBe(true);
  });

  it('preview de acesso mascara a senha', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      clientAccounts: [{ email: 'ana@loja.com' }],
    });
    const preview = await service.preview('lead-1', 'credentials');
    expect(preview.text).toContain('••••••••');
    expect(preview.text).toContain('ana@loja.com');
    expect(preview.notice).toMatch(/senha/i);
    expect(preview.canSend).toBe(true);
  });

  it('envia o texto canônico e grava atividade', async () => {
    invites.create.mockResolvedValue({
      id: 'inv-1',
      registerUrl: 'http://localhost:5174/register.html?invite=real-token',
    });
    evolution.sendText.mockResolvedValue({ skipped: false, ok: true, data: {} });

    const result = await service.send('lead-1', 'site-introduction');

    expect(evolution.sendText).toHaveBeenCalledWith({
      phone: '+5511999999999',
      text: expect.stringContaining('invite=real-token'),
    });
    expect(result.sent).toBe(true);
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        channel: 'whatsapp',
        kind: 'site-introduction',
        summary: 'Enviado para +5511999999999',
      }),
    );
  });

  it('envia o texto editado substituindo o convite de prévia', async () => {
    invites.create.mockResolvedValue({
      id: 'inv-1',
      registerUrl: 'http://localhost:5174/register.html?invite=real-token',
    });
    evolution.sendText.mockResolvedValue({ skipped: false, ok: true, data: {} });

    await service.send(
      'lead-1',
      'site-introduction',
      'Oi! Cadastre-se: http://localhost:5174/register.html?invite=preview',
    );

    expect(evolution.sendText).toHaveBeenCalledWith({
      phone: '+5511999999999',
      text: 'Oi! Cadastre-se: http://localhost:5174/register.html?invite=real-token',
    });
  });

  it('recusa envio sem número', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      phone: null,
      whatsapp: null,
    });
    await expect(service.send('lead-1', 'instagram-permission')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(evolution.sendText).not.toHaveBeenCalled();
    expect(activity.record).not.toHaveBeenCalled();
  });

  it('recusa envio sem Evolution', async () => {
    evolution.configured.mockReturnValue(false);
    await expect(service.send('lead-1', 'instagram-permission')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('propaga falha da Evolution como erro HTTP', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      clientAccounts: [{ email: 'ana@loja.com' }],
    });
    evolution.sendText.mockResolvedValue({
      skipped: false,
      ok: false,
      error: 'timeout',
    });
    await expect(service.send('lead-1', 'instagram-permission')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(activity.record).not.toHaveBeenCalled();
  });

  it('envia credenciais com senha real no lugar da máscara', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      clientAccounts: [{ email: 'ana@loja.com' }],
    });
    accounts.resetPassword.mockResolvedValue({
      email: 'ana@loja.com',
      password: 'senha-real',
    });
    evolution.sendText.mockResolvedValue({ skipped: false, ok: true, data: {} });

    await service.send(
      'lead-1',
      'credentials',
      'Senha: •••••••• — boa sorte.',
    );

    expect(evolution.sendText).toHaveBeenCalledWith({
      phone: '+5511999999999',
      text: 'Senha: senha-real — boa sorte.',
    });
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        kind: 'credentials',
      }),
    );
  });

  it('não envia pedido de Instagram se já conectou', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      ...lead,
      instagramConnections: [{ username: 'firma.lab' }],
    });
    const result = await service.send('lead-1', 'instagram-permission');
    expect(result).toMatchObject({
      sent: false,
      alreadyConnected: true,
      username: 'firma.lab',
    });
    expect(evolution.sendText).not.toHaveBeenCalled();
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
      { id: 'pkg-1', name: 'Site', price: 1200, currency: 'BRL' },
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
      description: null,
      benefits: ['Google'],
      price: 1200,
      promoPrice: 800,
      currency: 'BRL',
      status: 'active',
    });
    packages.getOfferTemplate.mockResolvedValue({
      emailSubject: '',
      emailBody: '',
      whatsappMessage: '{{lead.name}} · {{package.name}} · {{package.priceLine}}',
    });
    const preview = await service.preview('lead-1', 'package-offer', 'pkg-1');
    expect(preview.text).toContain('Firma');
    expect(preview.text).toContain('Site Estratégico');
    expect(preview.canSend).toBe(true);
    expect(preview.packageId).toBe('pkg-1');
  });

  it('envia a proposta pelo WhatsApp', async () => {
    packages.requireActive.mockResolvedValue({
      id: 'pkg-1',
      name: 'Site Estratégico',
      summary: null,
      description: null,
      benefits: [],
      price: 1200,
      promoPrice: null,
      currency: 'BRL',
      status: 'active',
    });
    packages.getOfferTemplate.mockResolvedValue({
      emailSubject: '',
      emailBody: '',
      whatsappMessage: 'Proposta {{package.name}}',
    });
    evolution.sendText.mockResolvedValue({ skipped: false, ok: true, data: {} });
    const result = await service.send(
      'lead-1',
      'package-offer',
      undefined,
      'pkg-1',
    );
    expect(evolution.sendText).toHaveBeenCalledWith({
      phone: '+5511999999999',
      text: 'Proposta Site Estratégico',
    });
    expect(result.sent).toBe(true);
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        kind: 'package-offer',
      }),
    );
  });
});
