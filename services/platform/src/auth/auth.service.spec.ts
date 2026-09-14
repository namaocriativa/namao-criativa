import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    invite: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    customer: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    instagramConnection: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const mail = { sendCredentials: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5174') };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    mail as never,
    config as never,
  );

  const pendingInvite = {
    id: 'inv-1',
    token: 'tok',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86_400_000),
    leadId: 'lead-1',
    customerId: null,
    lead: { id: 'lead-1', email: null, instagram: null },
    customer: null,
  };
  const createdUser = {
    id: 'u1',
    email: 'ana@loja.com',
    name: 'Ana',
    role: 'CLIENT',
    leadId: 'lead-1',
    customerId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.sign.mockReturnValue('token');
    config.get.mockReturnValue('http://localhost:5174');
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.invite.findUnique.mockResolvedValue(pendingInvite);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);
    prisma.lead.create.mockResolvedValue({ id: 'lead-new' });
    prisma.lead.update.mockResolvedValue({});
    prisma.lead.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.instagramConnection.findFirst.mockResolvedValue(null);
    prisma.invite.update.mockResolvedValue({});
    mail.sendCredentials.mockResolvedValue(undefined);
  });

  it('cria lead, gera senha e envia o acesso por e-mail', async () => {
    const result = await service.register({
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: '@loja_ana',
    });

    expect(result).toEqual({ ok: true, mailed: true });
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Ana',
          email: 'ana@loja.com',
          instagram: 'https://www.instagram.com/loja_ana/',
          fromPublicSignup: true,
        }),
      }),
    );
    expect(mail.sendCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@loja.com',
        email: 'ana@loja.com',
        name: 'Ana',
        loginUrl: 'http://localhost:5174/login.html',
      }),
    );
    const sentPassword = mail.sendCredentials.mock.calls[0][0].password as string;
    expect(sentPassword.length).toBeGreaterThanOrEqual(12);
  });

  it('vincula o convite ao lead existente', async () => {
    await service.register({
      inviteToken: 'tok',
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: 'loja_ana',
    });

    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(prisma.invite.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'ACCEPTED' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: 'lead-1', customerId: null }),
      }),
    );
    expect(prisma.lead.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromPublicSignup: true }),
      }),
    );
  });

  it('cria a conta mesmo se o e-mail da senha falhar', async () => {
    mail.sendCredentials.mockRejectedValue(new Error('resend down'));
    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@loja.com',
        instagram: 'loja_ana',
      }),
    ).resolves.toEqual({ ok: true, mailed: false });
  });

  it('rejeita convite inválido', async () => {
    prisma.invite.findUnique.mockResolvedValue(null);
    await expect(
      service.register({
        inviteToken: 'missing',
        name: 'Ana',
        email: 'ana@loja.com',
        instagram: 'loja_ana',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.sendCredentials).not.toHaveBeenCalled();
  });

  const jwtUser = {
    id: 'u1',
    email: 'ana@loja.com',
    name: 'Ana',
    role: 'CLIENT',
    leadId: 'lead-1',
    customerId: null as string | null,
  };

  it('me devolve accountKind lead, instagram e contato', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Loja Ana',
      email: 'ana@loja.com',
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      fromPublicSignup: true,
      publishedOrigin: 'https://loja-ana.vercel.app',
    });
    prisma.instagramConnection.findFirst.mockResolvedValue({
      username: 'loja_ana',
      igUserId: 'ig-1',
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'NAMAO_WHATSAPP') return '+5519997306695';
      return 'http://localhost:5174';
    });

    const result = await service.me(jwtUser);

    expect(result.accountKind).toBe('lead');
    expect(result.lead).toEqual(
      expect.objectContaining({
        id: 'lead-1',
        fromPublicSignup: true,
      }),
    );
    expect(result.instagram).toEqual({
      connected: true,
      username: 'loja_ana',
      igUserId: 'ig-1',
    });
    expect(result.contactWhatsAppUrl).toContain('https://wa.me/5519997306695?text=');
    expect(result.contactWhatsAppUrl).toContain(encodeURIComponent('pagamento'));
  });

  it('me devolve accountKind customer quando o perfil já foi convertido', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Loja Ana',
      fromPublicSignup: true,
    });

    const result = await service.me({
      ...jwtUser,
      leadId: null,
      customerId: 'lead-1',
    });

    expect(result.accountKind).toBe('customer');
    expect(result.lead).toEqual(
      expect.objectContaining({ id: 'lead-1', name: 'Loja Ana' }),
    );
    expect(result.instagram).toEqual({ connected: false });
  });

  it('studioLogin rejeita CLIENT', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...createdUser,
      passwordHash: await require('bcryptjs').hash('password1', 4),
    });
    await expect(
      service.studioLogin({ email: 'ana@loja.com', password: 'password1' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('studioLogin aceita ADMIN', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@namao.local',
      name: 'Admin',
      role: 'ADMIN',
      leadId: null,
      customerId: null,
      passwordHash: hash,
    });
    const result = await service.studioLogin({
      email: 'admin@namao.local',
      password: 'password1',
    });
    expect(result.user.role).toBe('ADMIN');
    expect(result.accessToken).toBe('token');
  });

  it('ensureStudioAdmin cria o primeiro admin', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'STUDIO_ADMIN_EMAIL') return 'admin@namao.local';
      if (key === 'STUDIO_ADMIN_PASSWORD') return 'changeme123';
      return undefined;
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({});
    await service.ensureStudioAdmin();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@namao.local',
          role: 'ADMIN',
        }),
      }),
    );
  });
});
