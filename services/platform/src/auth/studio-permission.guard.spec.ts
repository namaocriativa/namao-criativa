import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtUser } from './identity';
import { IS_PUBLIC_KEY } from './public.decorator';
import { STUDIO_PERMISSION, USER_ROLE } from './roles';
import { STUDIO_PERMISSION_KEY } from './studio-permission.decorator';
import { StudioPermissionGuard } from './studio-permission.guard';

function contextWith(user?: Partial<JwtUser>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('StudioPermissionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new StudioPermissionGuard(reflector as unknown as Reflector);

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

  it('libera quando não há permissão exigida', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('admin passa sem flag', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === STUDIO_PERMISSION_KEY) return STUDIO_PERMISSION.IMAGES;
      return undefined;
    });
    expect(guard.canActivate(contextWith({ role: USER_ROLE.ADMIN }))).toBe(
      true,
    );
  });

  it('operador sem flag toma 403', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === STUDIO_PERMISSION_KEY) return STUDIO_PERMISSION.VIDEOS;
      return undefined;
    });
    expect(
      guard.canActivate(
        contextWith({
          role: USER_ROLE.OPERATOR,
          canAccessVideos: false,
        }),
      ),
    ).toBe(false);
  });

  it('operador com flag passa', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === STUDIO_PERMISSION_KEY) return STUDIO_PERMISSION.IMAGES;
      return undefined;
    });
    expect(
      guard.canActivate(
        contextWith({
          role: USER_ROLE.OPERATOR,
          canAccessImages: true,
        }),
      ),
    ).toBe(true);
  });

  it('aceita imagens ou vídeos quando a rota lista as duas', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === STUDIO_PERMISSION_KEY) {
        return [STUDIO_PERMISSION.IMAGES, STUDIO_PERMISSION.VIDEOS];
      }
      return undefined;
    });
    expect(
      guard.canActivate(
        contextWith({
          role: USER_ROLE.OPERATOR,
          canAccessVideos: true,
        }),
      ),
    ).toBe(true);
  });
});
