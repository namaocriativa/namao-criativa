import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiteResolver {
  constructor(private readonly prisma: PrismaService) {}

  async byPublicSiteId(siteId: string) {
    return this.prisma.lead.findUnique({
      where: { publicSiteId: siteId },
      select: {
        id: true,
        chatEnabled: true,
        publicSiteId: true,
        publishedOrigin: true,
        landingSlug: true,
        name: true,
      },
    });
  }
}
