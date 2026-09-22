import {
  canAccessImages,
  canAccessVideos,
  hasStudioPermission,
  isTenantAdmin,
  STUDIO_PERMISSION,
  USER_ROLE,
} from './roles';

describe('studio permissions', () => {
  it('admin acessa imagens e vídeos sem flags', () => {
    const admin = { role: USER_ROLE.ADMIN };
    expect(canAccessImages(admin)).toBe(true);
    expect(canAccessVideos(admin)).toBe(true);
    expect(hasStudioPermission(admin, STUDIO_PERMISSION.IMAGES)).toBe(true);
    expect(hasStudioPermission(admin, STUDIO_PERMISSION.VIDEOS)).toBe(true);
  });

  it('operador sem flag não acessa', () => {
    const operator = { role: USER_ROLE.OPERATOR };
    expect(canAccessImages(operator)).toBe(false);
    expect(canAccessVideos(operator)).toBe(false);
  });

  it('operador acessa só a feature marcada', () => {
    const operator = {
      role: USER_ROLE.OPERATOR,
      canAccessImages: true,
      canAccessVideos: false,
    };
    expect(canAccessImages(operator)).toBe(true);
    expect(canAccessVideos(operator)).toBe(false);
    expect(hasStudioPermission(operator, STUDIO_PERMISSION.IMAGES)).toBe(true);
    expect(hasStudioPermission(operator, STUDIO_PERMISSION.VIDEOS)).toBe(false);
  });

  it('root impersonando acessa imagens e vídeos', () => {
    const root = { role: USER_ROLE.ROOT, tenantId: 't1' };
    expect(canAccessImages(root)).toBe(true);
    expect(canAccessVideos(root)).toBe(true);
    expect(isTenantAdmin(root)).toBe(true);
  });

  it('root sem conta não acessa imagens', () => {
    const root = { role: USER_ROLE.ROOT, tenantId: null };
    expect(canAccessImages(root)).toBe(false);
    expect(canAccessVideos(root)).toBe(false);
    expect(isTenantAdmin(root)).toBe(false);
    expect(canAccessImages(null)).toBe(false);
    expect(canAccessVideos(undefined)).toBe(false);
  });
});
