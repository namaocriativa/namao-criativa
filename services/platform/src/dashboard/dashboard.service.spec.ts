import { DashboardService } from './dashboard.service';
import type { Ga4Client } from './ga4.client';

describe('DashboardService', () => {
  const owners = { findProfile: jest.fn() };
  const redis = { get: jest.fn(), setex: jest.fn() };
  const ga4 = {
    configured: jest.fn(),
    runReport: jest.fn(),
  };
  const service = new DashboardService(
    owners as never,
    redis as never,
    ga4 as unknown as Ga4Client,
  );
  const user = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Ana',
    role: 'CLIENT',
    leadId: 'lead-1',
    customerId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue(true);
  });

  it('unpublished quando o lead não tem origem pública', async () => {
    owners.findProfile.mockResolvedValue({ publishedOrigin: null });
    await expect(service.analytics(user)).resolves.toEqual({
      status: 'unpublished',
    });
  });

  it('unconfigured quando falta credencial GA4', async () => {
    owners.findProfile.mockResolvedValue({
      publishedOrigin: 'https://ld-firma.vercel.app',
    });
    ga4.configured.mockReturnValue(false);
    await expect(service.analytics(user)).resolves.toEqual({
      status: 'unconfigured',
    });
  });

  it('filtra por hostname e monta KPIs', async () => {
    owners.findProfile.mockResolvedValue({
      publishedOrigin: 'https://ld-firma.vercel.app',
    });
    ga4.configured.mockReturnValue(true);
    ga4.runReport
      .mockResolvedValueOnce([
        { dimensionValues: [], metricValues: [12, 18, 40, 0.55] },
      ])
      .mockResolvedValueOnce([
        { dimensionValues: ['/'], metricValues: [30] },
        { dimensionValues: ['/contato'], metricValues: [10] },
      ])
      .mockResolvedValueOnce([
        { dimensionValues: ['Organic Search'], metricValues: [9] },
      ]);

    const result = await service.analytics(user, '7d');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok' && result.status !== 'empty') return;
    expect(result.hostname).toBe('ld-firma.vercel.app');
    expect(result.kpis.users).toBe(12);
    expect(result.topPages[0]).toEqual({ path: '/', views: 30 });
    expect(ga4.runReport).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'ld-firma.vercel.app' }),
    );
  });
});
