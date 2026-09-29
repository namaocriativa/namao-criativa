import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadAccountService } from './lead-account.service';

describe('LeadAccountService', () => {
  const prisma = {
    clientAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
  };
  const mail = {
    sendCredentials: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5174'),
  };

  const owners = {
    requireKind: jest.fn().mockResolvedValue('lead'),
    findProfile: jest.fn(),
  };

  const service = new LeadAccountService(
    prisma as never,
    mail as never,
    config as never,
    owners as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5174');
    owners.requireKind.mockResolvedValue('lead');
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });
  });

  it('não recria senha se o lead já tem login no portal', async () => {
    prisma.clientAccount.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'ana@loja.com',
      name: 'Ana',
      leadId: 'lead-1',
      customerId: null,
    });

    const user = await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });

    expect(user.email).toBe('ana@loja.com');
    expect(user.role).toBe('CLIENT');
    expect(prisma.clientAccount.create).not.toHaveBeenCalled();
  });

  it('cria ClientAccount com e-mail do lead', async () => {
    prisma.clientAccount.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findUnique.mockResolvedValue(null);
    prisma.lead.findUnique.mockResolvedValue({ tenantId: 't1' });
    prisma.clientAccount.create.mockResolvedValue({
      id: 'u2',
      email: 'ana@loja.com',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });

    await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });

    expect(prisma.clientAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ana@loja.com',
          leadId: 'lead-1',
          customerId: null,
          tenantId: 't1',
        }),
      }),
    );
    expect(prisma.clientAccount.create.mock.calls[0][0].data).not.toHaveProperty(
      'role',
    );
  });

  it('troca o login interno pelo e-mail do lead quando ele passa a ser válido', async () => {
    prisma.clientAccount.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'lead+abc@clientes.namao.local',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });
    prisma.clientAccount.findUnique.mockResolvedValue(null);
    prisma.clientAccount.update.mockResolvedValue({
      id: 'u1',
      email: 'ana@loja.com',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });

    const user = await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });

    expect(prisma.clientAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { email: 'ana@loja.com' },
      }),
    );
    expect(user.email).toBe('ana@loja.com');
    expect(prisma.clientAccount.create).not.toHaveBeenCalled();
  });

  it('mantém o login real mesmo se o e-mail do lead mudar', async () => {
    prisma.clientAccount.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'ana@loja.com',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });

    const user = await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'novo@loja.com',
    });

    expect(user.email).toBe('ana@loja.com');
    expect(prisma.clientAccount.update).not.toHaveBeenCalled();
  });

  it('sendPassword envia para o e-mail do lead quando o login ainda é interno', async () => {
    prisma.clientAccount.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'lead+abc@clientes.namao.local',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });
    prisma.clientAccount.findUnique.mockResolvedValue(null);
    prisma.clientAccount.update
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'ana@loja.com',
        name: 'Firma',
        leadId: 'lead-1',
        customerId: null,
      })
      .mockResolvedValueOnce({});

    const result = await service.sendPassword('lead-1');

    expect(result.email).toBe('ana@loja.com');
    expect(result.sent).toBe(true);
    expect(mail.sendCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@loja.com', email: 'ana@loja.com' }),
    );
  });

  it('GET account 404 se lead não existe', async () => {
    owners.findProfile.mockResolvedValue(null);
    await expect(service.getAccount('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sendPassword recusa fallback', async () => {
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: null,
    });
    prisma.clientAccount.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'lead+abc@clientes.namao.local',
      name: 'Firma',
      leadId: 'lead-1',
      customerId: null,
    });

    await expect(service.sendPassword('lead-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mail.sendCredentials).not.toHaveBeenCalled();
  });
});
