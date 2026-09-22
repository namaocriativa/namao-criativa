import { lastValueFrom, of } from 'rxjs';
import type { ExecutionContext } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import { StudioActivityInterceptor } from './studio-activity.interceptor';

describe('StudioActivityInterceptor', () => {
  const activity = { record: jest.fn().mockResolvedValue(undefined) };
  const interceptor = new StudioActivityInterceptor(activity as never);

  function context(req: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    activity.record.mockResolvedValue(undefined);
  });

  it('grava POST 2xx de operador', async () => {
    const next = { handle: () => of({ ok: true }) };
    await lastValueFrom(
      interceptor.intercept(
        context({
          method: 'POST',
          path: '/enrichment',
          originalUrl: '/enrichment',
          params: {},
          user: {
            id: 'op-1',
            email: 'op@namao.local',
            name: 'Op',
            role: USER_ROLE.OPERATOR,
            tenantId: 't1',
            leadId: null,
            customerId: null,
          },
        }),
        next,
      ),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'op-1',
        kind: 'enrichment.run',
        title: 'Rodou enrichment',
      }),
    );
  });

  it('ignora GET', async () => {
    const next = { handle: () => of({ items: [] }) };
    await lastValueFrom(
      interceptor.intercept(
        context({
          method: 'GET',
          path: '/leads',
          originalUrl: '/leads',
          user: {
            id: 'op-1',
            role: USER_ROLE.OPERATOR,
          },
        }),
        next,
      ),
    );
    expect(activity.record).not.toHaveBeenCalled();
  });

  it('ignora CLIENT', async () => {
    const next = { handle: () => of({ ok: true }) };
    await lastValueFrom(
      interceptor.intercept(
        context({
          method: 'POST',
          path: '/enrichment',
          originalUrl: '/enrichment',
          user: {
            id: 'c1',
            role: USER_ROLE.CLIENT,
          },
        }),
        next,
      ),
    );
    expect(activity.record).not.toHaveBeenCalled();
  });
});
