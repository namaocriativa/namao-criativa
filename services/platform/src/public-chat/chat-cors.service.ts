import { Injectable } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { isPreviewOrigin, isPublicChatPath } from './cors-policy';

@Injectable()
export class ChatCorsService {
  constructor(private readonly owners: OwnerLookup) {}

  async isAllowed(origin?: string, path?: string): Promise<boolean> {
    if (!origin) return true;
    const normalized = origin.replace(/\/$/, '');
    if (isPreviewOrigin(normalized)) return true;
    if (!isPublicChatPath(path)) return false;
    const profile = await this.owners.findByPublishedOrigin(normalized);
    return Boolean(profile);
  }
}
