import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { StudioPermissionName } from './roles';
import { StudioAuth } from './studio-auth.decorator';

export const STUDIO_PERMISSION_KEY = 'studioPermission';
export { STUDIO_PERMISSION } from './roles';

export function StudioPermission(...permissions: StudioPermissionName[]) {
  const value =
    permissions.length <= 1 ? permissions[0] : permissions;
  return applyDecorators(
    StudioAuth(),
    SetMetadata(STUDIO_PERMISSION_KEY, value),
  );
}
