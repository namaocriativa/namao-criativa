import { Injectable } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';

@Injectable()
export class SiteResolver {
  constructor(private readonly owners: OwnerLookup) {}

  async byPublicSiteId(siteId: string) {
    return this.owners.findByPublicSiteId(siteId);
  }
}
