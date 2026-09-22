import { ConflictException } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { EnrichmentService } from './enrichment.service';
import { runWithTenant } from '../tenant/tenant-context';

function actor(id = 'op-1'): JwtUser {
  return {
    id,
    email: `${id}@n.co`,
    name: id,
    role: USER_ROLE.OPERATOR,
    tenantId: 'tenant-1',
    leadId: null,
    customerId: null,
  };
}

describe('EnrichmentService access', () => {
  const prisma = {
    lead: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    leadSource: { deleteMany: jest.fn(), createMany: jest.fn() },
    leadImage: { findMany: jest.fn(), create: jest.fn() },
  };
  const access = {
    hasAccess: jest.fn(),
    assertCanAccess: jest.fn(),
  };
  const service = new EnrichmentService(
    prisma as never,
    { merge: jest.fn() } as never,
    { downloadImage: jest.fn() } as never,
    { find: jest.fn() } as never,
    { ensureForLead: jest.fn() } as never,
    [] as never,
    access as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(service as never, 'runPipeline' as never).mockResolvedValue({
      id: 'lead-1',
    } as never);
  });

  it('409 se o dedupe achar lead sem acesso', async () => {
    prisma.lead.findMany.mockResolvedValue([
      {
        id: 'lead-1',
        name: 'Firma',
        city: null,
        state: null,
        website: 'https://firma.com',
      },
    ]);
    access.hasAccess.mockResolvedValue(false);

    await expect(
      runWithTenant('tenant-1', () =>
        service.enrich({ name: 'Firma', website: 'https://firma.com' }, actor()),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('grava createdByUserId em lead novo', async () => {
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.create.mockResolvedValue({ id: 'lead-new', name: 'Firma' });

    await runWithTenant('tenant-1', () =>
      service.enrich({ name: 'Firma' }, actor('op-9')),
    );

    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Firma',
        createdByUserId: 'op-9',
        tenantId: 'tenant-1',
      }),
    });
  });

  it('refresh exige acesso', async () => {
    access.assertCanAccess.mockRejectedValue(new ConflictException());
    await expect(service.reenrich('lead-1', actor())).rejects.toBeTruthy();
    expect(prisma.lead.findUnique).not.toHaveBeenCalled();
  });
});
