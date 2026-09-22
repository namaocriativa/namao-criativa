import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from './studio-lead-access.service';

function actor(
  id: string,
  role: string = USER_ROLE.OPERATOR,
): JwtUser {
  return {
    id,
    email: `${id}@n.co`,
    name: id,
    role,
    tenantId: 't1',
    leadId: null,
    customerId: null,
  };
}

describe('StudioLeadAccessService', () => {
  const prisma = {
    lead: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
  };
  const service = new StudioLeadAccessService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('404 se o perfil não existe', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(
      service.assertCanAccess(actor('op-1'), 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 se operador não tem acesso a lead sem dono', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      createdByUserId: null,
      studioShares: [],
    });
    await expect(
      service.assertCanAccess(actor('op-1'), 'lead-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin acessa lead sem dono', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      createdByUserId: null,
      studioShares: [],
    });
    const record = await service.assertCanAccess(
      actor('admin-1', USER_ROLE.ADMIN),
      'lead-1',
    );
    expect(record.kind).toBe('lead');
  });

  it('operador acessa lead compartilhado', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      createdByUserId: 'op-2',
      studioShares: [{ userId: 'op-1' }],
    });
    await expect(
      service.assertCanAccess(actor('op-1'), 'lead-1'),
    ).resolves.toMatchObject({ id: 'lead-1', kind: 'lead' });
  });

  it('operador compartilhado não gerencia shares', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      createdByUserId: 'op-2',
      studioShares: [{ userId: 'op-1' }],
    });
    await expect(
      service.assertCanManageShares(actor('op-1'), 'lead-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('criador gerencia shares', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    await expect(
      service.assertCanManageShares(actor('op-1'), 'lead-1'),
    ).resolves.toMatchObject({ createdByUserId: 'op-1' });
  });
});
