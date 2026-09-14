import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadShareService } from './studio-lead-share.service';

function actor(id: string, role: string = USER_ROLE.OPERATOR): JwtUser {
  return {
    id,
    email: `${id}@n.co`,
    name: id,
    role,
    leadId: null,
    customerId: null,
  };
}

describe('StudioLeadShareService', () => {
  const prisma = {
    studioLeadShare: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const access = {
    assertCanAccess: jest.fn(),
    assertCanManageShares: jest.fn(),
  };
  const service = new StudioLeadShareService(prisma as never, access as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.studioLeadShare.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('POST recusa quem não gerencia', async () => {
    access.assertCanManageShares.mockRejectedValue(new ForbiddenException());
    await expect(
      service.add(actor('op-1'), 'lead-1', 'op-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.studioLeadShare.create).not.toHaveBeenCalled();
  });

  it('POST recusa o próprio usuário e quem não é staff', async () => {
    access.assertCanManageShares.mockResolvedValue({
      kind: 'lead',
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    await expect(
      service.add(actor('op-1'), 'lead-1', 'op-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.add(actor('op-1'), 'lead-1', 'client-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST cria share e é idempotente', async () => {
    access.assertCanManageShares.mockResolvedValue({
      kind: 'lead',
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    access.assertCanAccess.mockResolvedValue({
      kind: 'lead',
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'op-2',
      role: USER_ROLE.OPERATOR,
    });
    prisma.studioLeadShare.findFirst.mockResolvedValue(null);

    await service.add(actor('op-1'), 'lead-1', 'op-2');
    expect(prisma.studioLeadShare.create).toHaveBeenCalledWith({
      data: { leadId: 'lead-1', customerId: null, userId: 'op-2' },
    });

    prisma.studioLeadShare.findFirst.mockResolvedValue({ id: 'share-1' });
    prisma.studioLeadShare.create.mockClear();
    await service.add(actor('op-1'), 'lead-1', 'op-2');
    expect(prisma.studioLeadShare.create).not.toHaveBeenCalled();
  });

  it('DELETE remove o share', async () => {
    access.assertCanManageShares.mockResolvedValue({
      kind: 'lead',
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    access.assertCanAccess.mockResolvedValue({
      kind: 'lead',
      id: 'lead-1',
      createdByUserId: 'op-1',
      studioShares: [],
    });
    prisma.studioLeadShare.deleteMany.mockResolvedValue({ count: 1 });
    await service.remove(actor('op-1'), 'lead-1', 'op-2');
    expect(prisma.studioLeadShare.deleteMany).toHaveBeenCalled();
  });
});
