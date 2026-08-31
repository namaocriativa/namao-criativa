import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isPreviewOrigin, staticCorsOrigins } from './cors-policy';

@Injectable()
export class ChatCorsService {
  constructor(private readonly prisma: PrismaService) {}

  async isAllowed(origin?: string): Promise<boolean> {
    if (!origin) return true;
    const normalized = origin.replace(/\/$/, '');
    if (isPreviewOrigin(normalized)) return true;
    if (staticCorsOrigins().includes(normalized)) return true;
    const lead = await this.prisma.lead.findFirst({
      where: { publishedOrigin: normalized, chatEnabled: true },
      select: { id: true },
    });
    return Boolean(lead);
  }
}
