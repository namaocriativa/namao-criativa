import { randomBytes } from 'crypto';

export function newPublicSiteId(): string {
  return `site_${randomBytes(12).toString('base64url')}`;
}
