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
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    clientAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    instagramConnection: {
      findFirst: jest.fn(),
    },
    proposal: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const mail = { sendCredentials: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5174') };
  const activity = {
    recordLogin: jest.fn().mockResolvedValue(undefined),
    recordLogout: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    mail as never,
    config as never,
    activity as never,
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
    prisma.user.create.mockResolvedValue({});
    prisma.clientAccount.findUnique.mockResolvedValue(null);
    prisma.clientAccount.create.mockResolvedValue(createdUser);
    prisma.lead.create.mockResolvedValue({ id: 'lead-new' });
    prisma.lead.update.mockResolvedValue({});
    prisma.lead.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.instagramConnection.findFirst.mockResolvedValue(null);
    prisma.proposal.findFirst.mockResolvedValue(null);
    prisma.invite.update.mockResolvedValue({});
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'namao_default_tenant',
      name: 'Namão',
      status: 'active',
    });
    prisma.tenant.create.mockResolvedValue({ id: 'namao_default_tenant' });
    mail.sendCredentials.mockResolvedValue(undefined);
    activity.recordLogin.mockResolvedValue(undefined);
    activity.recordLogout.mockResolvedValue(undefined);
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
          tenantId: 'namao_default_tenant',
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
    expect(prisma.clientAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: 'lead-1', customerId: null, tenantId: 'namao_default_tenant' }),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
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
    tenantId: 'namao_default_tenant',
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
    expect(result.proposal).toBeNull();
    expect(result.payment).toBeNull();
  });

  it('me devolve proposta pendente', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Loja Ana',
    });
    prisma.proposal.findFirst.mockResolvedValue({
      id: 'prop-1',
      status: 'pending',
      paymentStatus: 'pending',
      collectPayment: true,
      acceptedAt: null,
      paidAt: null,
      packageSnapshot: { name: 'Site', price: 800, currency: 'BRL' },
    });
    const result = await service.me(jwtUser);
    expect(result.proposal).toEqual({
      status: 'pending',
      paymentStatus: 'pending',
    });
    expect(result.payment).toBeNull();
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

  it('login autentica ClientAccount e assina typ client', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.clientAccount.findUnique.mockResolvedValue({
      ...createdUser,
      passwordHash: hash,
    });
    const result = await service.login({
      email: 'ana@loja.com',
      password: 'password1',
    });
    expect(result.user.role).toBe('CLIENT');
    expect(result.user.typ).toBe('client');
    expect(result.accessToken).toBe('token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        role: 'CLIENT',
        typ: 'client',
      }),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('studioLogin rejeita e-mail que só existe no portal', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.clientAccount.findUnique.mockResolvedValue({
      ...createdUser,
      passwordHash: await require('bcryptjs').hash('password1', 4),
    });
    await expect(
      service.studioLogin({ email: 'ana@loja.com', password: 'password1' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(prisma.clientAccount.findUnique).not.toHaveBeenCalled();
  });

  it('studioLogin aceita ADMIN', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@namao.local',
      name: 'Admin',
      role: 'ADMIN',
      tenantId: 't1',
      leadId: null,
      customerId: null,
      passwordHash: hash,
      tenant: { id: 't1', name: 'Namão', status: 'active' },
    });
    const result = await service.studioLogin({
      email: 'admin@namao.local',
      password: 'password1',
    });
    expect(result.user.role).toBe('ADMIN');
    expect(result.user.typ).toBe('staff');
    expect(result.accessToken).toBe('token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'a1',
        role: 'ADMIN',
        typ: 'staff',
      }),
      { expiresIn: '30d' },
    );
    expect(activity.recordLogin).toHaveBeenCalledWith('a1');
  });

  it('studioLogin emite sessão curta quando rememberMe é false', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@namao.local',
      name: 'Admin',
      role: 'ADMIN',
      tenantId: 't1',
      leadId: null,
      customerId: null,
      passwordHash: hash,
      tenant: { id: 't1', name: 'Namão', status: 'active' },
    });
    await service.studioLogin({
      email: 'admin@namao.local',
      password: 'password1',
      rememberMe: false,
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'a1', typ: 'staff' }),
      { expiresIn: '12h' },
    );
  });

  it('studioLogin ROOT amarra o tenant Namão', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'root-1',
      email: 'root@namao.local',
      name: 'Root',
      role: 'ROOT',
      tenantId: null,
      leadId: null,
      customerId: null,
      passwordHash: hash,
      tenant: null,
    });
    const result = await service.studioLogin({
      email: 'root@namao.local',
      password: 'password1',
    });
    expect(result.user.role).toBe('ROOT');
    expect(result.user.tenantId).toBe('namao_default_tenant');
    expect(result.user.impersonatingTenantId).toBe('namao_default_tenant');
    expect(result.user.tenantName).toBe('Namão');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'root-1',
        role: 'ROOT',
        tenantId: 'namao_default_tenant',
        impersonatingTenantId: 'namao_default_tenant',
      }),
      { expiresIn: '30d' },
    );
  });

  it('adminLogin aceita ROOT sem tenant', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'root-1',
      email: 'root@namao.local',
      name: 'Root',
      role: 'ROOT',
      tenantId: null,
      leadId: null,
      customerId: null,
      passwordHash: hash,
      tenant: null,
    });
    const result = await service.adminLogin({
      email: 'root@namao.local',
      password: 'password1',
    });
    expect(result.user.role).toBe('ROOT');
    expect(result.user.tenantId).toBeNull();
    expect(result.user.impersonatingTenantId).toBeNull();
    expect(activity.recordLogin).not.toHaveBeenCalled();
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'root-1',
        role: 'ROOT',
        tenantId: null,
      }),
      { expiresIn: '30d' },
    );
  });

  it('adminLogin recusa ADMIN e OPERATOR', async () => {
    const hash = await require('bcryptjs').hash('password1', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@namao.local',
      name: 'Admin',
      role: 'ADMIN',
      tenantId: 't1',
      passwordHash: hash,
      tenant: { id: 't1', name: 'Namão', status: 'active' },
    });
    await expect(
      service.adminLogin({
        email: 'admin@namao.local',
        password: 'password1',
      }),
    ).rejects.toMatchObject({ status: 403 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'o1',
      email: 'op@namao.local',
      name: 'Op',
      role: 'OPERATOR',
      tenantId: 't1',
      passwordHash: hash,
      tenant: { id: 't1', name: 'Namão', status: 'active' },
    });
    await expect(
      service.adminLogin({
        email: 'op@namao.local',
        password: 'password1',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ensureStudioRoot cria o primeiro root', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'STUDIO_ADMIN_EMAIL') return 'admin@namao.local';
      if (key === 'STUDIO_ADMIN_PASSWORD') return 'changeme123';
      return undefined;
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({});
    await service.ensureStudioRoot();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@namao.local',
          role: 'ROOT',
          tenantId: null,
        }),
      }),
    );
  });

  it('ensureStudioRoot promove ADMIN existente a ROOT sem tenant', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'STUDIO_ADMIN_EMAIL') return 'admin@namao.local';
      if (key === 'STUDIO_ADMIN_PASSWORD') return 'changeme123';
      return undefined;
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@namao.local',
      role: 'ADMIN',
      tenantId: 'namao_default_tenant',
    });
    prisma.user.update.mockResolvedValue({});
    await service.ensureStudioRoot();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { role: 'ROOT', tenantId: null },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
