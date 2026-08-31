import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadAccountService } from './lead-account.service';

describe('LeadAccountService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      findUnique: jest.fn(),
    },
  };
  const mail = {
    sendCredentials: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5174'),
  };

  const service = new LeadAccountService(
    prisma as never,
    mail as never,
    config as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5174');
  });

  it('não recria senha se o lead já tem CLIENT', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'ana@loja.com',
      name: 'Ana',
      role: 'CLIENT',
      leadId: 'lead-1',
    });

    const user = await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });

    expect(user.email).toBe('ana@loja.com');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('cria user com e-mail do lead', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u2',
      email: 'ana@loja.com',
      name: 'Firma',
      role: 'CLIENT',
      leadId: 'lead-1',
    });

    await service.ensureForLead({
      id: 'lead-1',
      name: 'Firma',
      email: 'ana@loja.com',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ana@loja.com',
          role: 'CLIENT',
          leadId: 'lead-1',
        }),
      }),
    );
  });

  it('GET account 404 se lead não existe', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    await expect(service.getAccount('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sendPassword recusa fallback', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      email: null,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'lead+abc@clientes.namao.local',
      name: 'Firma',
      role: 'CLIENT',
      leadId: 'lead-1',
    });

    await expect(service.sendPassword('lead-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mail.sendCredentials).not.toHaveBeenCalled();
  });
});
