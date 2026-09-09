import { Injectable } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { isPreviewOrigin, staticCorsOrigins } from './cors-policy';

@Injectable()
export class ChatCorsService {
  constructor(private readonly owners: OwnerLookup) {}

  async isAllowed(origin?: string): Promise<boolean> {
    if (!origin) return true;
    const normalized = origin.replace(/\/$/, '');
    if (isPreviewOrigin(normalized)) return true;
    if (staticCorsOrigins().includes(normalized)) return true;
    const profile = await this.owners.findByPublishedOrigin(normalized);
    return Boolean(profile);
  }
}
