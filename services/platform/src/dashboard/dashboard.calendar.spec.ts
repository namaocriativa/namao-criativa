import { DashboardService } from './dashboard.service';
import type { Ga4Client } from './ga4.client';

describe('DashboardService.calendar', () => {
  const owners = { findProfile: jest.fn() };
  const redis = { get: jest.fn(), setex: jest.fn() };
  const ga4 = { configured: jest.fn(), runReport: jest.fn() };
  const prisma = {
    contentCalendarPost: { findMany: jest.fn() },
    contentCalendarReminder: { findMany: jest.fn() },
  };
  const service = new DashboardService(
    owners as never,
    redis as never,
    ga4 as unknown as Ga4Client,
    prisma as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista só posts e lembretes do owner do JWT', async () => {
    prisma.contentCalendarPost.findMany.mockResolvedValue([
      { id: 'post-1', title: 'Reel', scheduledAt: new Date() },
    ]);
    prisma.contentCalendarReminder.findMany.mockResolvedValue([
      { id: 'rem-1', title: 'Filmar', scheduledAt: new Date() },
    ]);
    const result = await service.calendar(
      {
        id: 'u1',
        email: 'a@b.com',
        name: 'Ana',
        role: 'CLIENT',
        leadId: 'lead-1',
        customerId: null,
      },
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.000Z',
    );
    expect(result.posts).toHaveLength(1);
    expect(result.reminders).toHaveLength(1);
    expect(prisma.contentCalendarPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ leadId: 'lead-1' }, { customerId: 'lead-1' }],
        }),
      }),
    );
    expect(prisma.contentCalendarReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ leadId: 'lead-1' }, { customerId: 'lead-1' }],
        }),
      }),
    );
  });

  it('não consulta outro owner quando o JWT não tem perfil', async () => {
    const result = await service.calendar({
      id: 'u2',
      email: 'x@y.com',
      name: 'X',
      role: 'CLIENT',
      leadId: null,
      customerId: null,
    });
    expect(result).toEqual({ posts: [], reminders: [] });
    expect(prisma.contentCalendarPost.findMany).not.toHaveBeenCalled();
    expect(prisma.contentCalendarReminder.findMany).not.toHaveBeenCalled();
  });
});
