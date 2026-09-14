import { applyDecorators } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { STUDIO_ROLES } from './roles';

export function StudioAuth() {
  return applyDecorators(Roles(...STUDIO_ROLES));
}
