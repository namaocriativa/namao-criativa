import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { JWT_TYP } from '../auth/identity';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';

function context(user?: Partial<JwtUser> | null, path = '/leads') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: user
          ? {
              id: 'u1',
              email: 'a@b.c',
              name: 'A',
              role: USER_ROLE.OPERATOR,
              typ: JWT_TYP.STAFF,
              tenantId: 't1',
              leadId: null,
              customerId: null,
              ...user,
            }
          : undefined,
        originalUrl: path,
        url: path,
      }),
    }),
  } as never;
}

describe('TenantGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };
  const guard = new TenantGuard(reflector as never);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('libera rota pública', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(context(null, '/auth/login'))).toBe(true);
  });

  it('libera CLIENT', () => {
    expect(
      guard.canActivate(
        context({
          role: USER_ROLE.CLIENT,
          typ: JWT_TYP.CLIENT,
          tenantId: 't1',
        }),
      ),
    ).toBe(true);
  });

  it('ROOT sem tenant só acessa o console', () => {
    expect(
      guard.canActivate(
        context(
          { role: USER_ROLE.ROOT, tenantId: null },
          '/studio/tenants',
        ),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context({ role: USER_ROLE.ROOT, tenantId: null }, '/leads'),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        context({ role: USER_ROLE.ROOT, tenantId: null }, '/packages'),
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        context({ role: USER_ROLE.ROOT, tenantId: null }, '/auth/admin/login'),
      ),
    ).toBe(true);
  });

  it('ROOT impersonando acessa o studio', () => {
    expect(
      guard.canActivate(
        context(
          {
            role: USER_ROLE.ROOT,
            tenantId: 't1',
            impersonatingTenantId: 't1',
          },
          '/leads',
        ),
      ),
    ).toBe(true);
  });

  it('ADMIN sem tenant é bloqueado', () => {
    expect(() =>
      guard.canActivate(
        context({ role: USER_ROLE.ADMIN, tenantId: null }, '/leads'),
      ),
    ).toThrow(ForbiddenException);
  });
});
