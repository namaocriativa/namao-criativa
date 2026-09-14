import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { USER_ROLE } from './roles';

function contextWith(user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
  });

  it('libera rota pública', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('libera quando não há papéis exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('bloqueia role fora da lista', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [USER_ROLE.ADMIN];
      return undefined;
    });
    expect(
      guard.canActivate(contextWith({ role: USER_ROLE.OPERATOR })),
    ).toBe(false);
  });

  it('aceita o papel listado', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [USER_ROLE.ADMIN, USER_ROLE.OPERATOR];
      return undefined;
    });
    expect(
      guard.canActivate(contextWith({ role: USER_ROLE.OPERATOR })),
    ).toBe(true);
  });
});
