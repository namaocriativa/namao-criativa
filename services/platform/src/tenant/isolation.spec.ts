import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { CalendarService } from '../calendar/calendar.service';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { LeadService } from '../lead/lead.service';
import { PackagesService } from '../packages/packages.service';
import { runWithTenant } from './tenant-context';
import { requireTenantId } from './tenant.util';

function admin(tenantId = 't1'): JwtUser {
  return {
    id: 'admin-1',
    email: 'admin@t1.local',
    name: 'Admin',
    role: USER_ROLE.ADMIN,
    tenantId,
    leadId: null,
    customerId: null,
  };
}

describe('isolamento multi-tenant', () => {
  it('ROOT sem tenant não lista dados de negócio', () => {
    expect(() => requireTenantId()).toThrow(ForbiddenException);
  });

  it('listagem de leads filtra pelo tenant', async () => {
    const prisma = {
      lead: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const access = {
      visibleWhere: jest.fn().mockReturnValue({}),
      present: (_actor: JwtUser, record: unknown) => record,
    };
    const service = new LeadService(
      prisma as never,
      { removeLeadDir: jest.fn() } as never,
      access as never,
    );
    await runWithTenant('t1', () => service.findAll(admin()));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ tenantId: 't1' }, {}] },
      }),
    );
  });

  it('GET lead de outro tenant vira 404', async () => {
    const prisma = {
      lead: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead-b',
          tenantId: 't2',
          images: [],
          sources: [],
        }),
      },
    };
    const service = new LeadService(
      prisma as never,
      { removeLeadDir: jest.fn() } as never,
      {
        present: (_actor: JwtUser, record: unknown) => record,
        visibleWhere: () => ({}),
      } as never,
    );
    await expect(
      runWithTenant('t1', () => service.findById('lead-b')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listagem de pacotes filtra pelo tenant', async () => {
    const prisma = {
      package: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PackagesService(
      prisma as never,
      {} as never,
    );
    await runWithTenant('t1', () => service.findAll());
    expect(prisma.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
      }),
    );
  });

  it('GET pacote de outro tenant vira 404', async () => {
    const prisma = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pkg-b',
          tenantId: 't2',
          images: [],
        }),
      },
    };
    const service = new PackagesService(prisma as never, {} as never);
    await expect(
      runWithTenant('t1', () => service.findById('pkg-b')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listagem de imagens filtra pelo tenant', async () => {
    const prisma = {
      imageProject: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ImageStudioService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await runWithTenant('t1', () => service.findAll());
    expect(prisma.imageProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
      }),
    );
  });

  it('GET imagem de outro tenant vira 404', async () => {
    const prisma = {
      imageProject: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'img-b',
          tenantId: 't2',
          settings: {},
        }),
      },
    };
    const service = new ImageStudioService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenant('t1', () => service.findById('img-b')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listagem de calendário filtra pelo tenant', async () => {
    const prisma = {
      contentCalendarPost: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CalendarService(prisma as never, {} as never);
    await runWithTenant('t1', () => service.findRange());
    expect(prisma.contentCalendarPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
      }),
    );
  });

  it('GET post de outro tenant vira 404', async () => {
    const prisma = {
      contentCalendarPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-b',
          tenantId: 't2',
          targets: [],
          assets: [],
        }),
      },
    };
    const service = new CalendarService(prisma as never, {} as never);
    await expect(
      runWithTenant('t1', () => service.findById('post-b')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
