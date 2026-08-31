import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { MongoPrismaService } from '../mongo/mongo-prisma.service';
import { CreateInviteRequestDto } from './dto/create-invite-request.dto';
import { InviteRateLimitService } from './invite-rate-limit.service';

@Injectable()
export class InviteRequestsService {
  constructor(
    private readonly mongo: MongoPrismaService,
    private readonly rateLimit: InviteRateLimitService,
  ) {}

  async create(req: Request, dto: CreateInviteRequestDto) {
    if (await this.rateLimit.tooMany(this.clientIp(req))) {
      throw new HttpException(
        'Muitos pedidos. Tente de novo em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const existing = await this.mongo.prisma.inviteRequest.findFirst({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      return { ok: true as const };
    }

    await this.mongo.prisma.inviteRequest.create({
      data: {
        name: dto.name,
        email: dto.email,
        instagram: dto.instagram,
        status: 'pending',
      },
    });

    return { ok: true as const };
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '0.0.0.0';
  }
}
