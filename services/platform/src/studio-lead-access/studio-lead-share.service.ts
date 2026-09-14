import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.strategy';
import { isStudioAdmin, isStudioRole, STUDIO_ROLES } from '../auth/roles';
import { ownerCreateData, ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from './studio-lead-access.service';
import { canManageShares } from './studio-lead-access.util';

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

@Injectable()
export class StudioLeadShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioLeadAccessService,
  ) {}

  async list(user: JwtUser, profileId: string) {
    const record = await this.access.assertCanAccess(user, profileId);
    const canManage = canManageShares(user, record.createdByUserId);
    const shares = await this.prisma.studioLeadShare.findMany({
      where: ownerWhere(profileId),
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        user: { select: USER_PUBLIC_SELECT },
      },
    });
    const excludeIds = [
      ...new Set(
        [record.createdByUserId, user.id, ...shares.map((row) => row.user.id)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const candidates = canManage
      ? await this.prisma.user.findMany({
          where: {
            role: { in: [...STUDIO_ROLES] },
            ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
          },
          select: USER_PUBLIC_SELECT,
          orderBy: { name: 'asc' },
        })
      : [];
    const createdBy = isStudioAdmin(user.role)
      ? record.createdByUserId
        ? await this.prisma.user.findUnique({
            where: { id: record.createdByUserId },
            select: USER_PUBLIC_SELECT,
          })
        : null
      : undefined;
    return {
      canManage,
      ...(isStudioAdmin(user.role) ? { createdBy } : {}),
      shares: shares.map((row) => ({
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        createdAt: row.createdAt,
      })),
      candidates,
    };
  }

  async add(user: JwtUser, profileId: string, targetUserId: string) {
    const record = await this.access.assertCanManageShares(user, profileId);
    if (targetUserId === user.id) {
      throw new BadRequestException('Não é possível compartilhar consigo mesmo');
    }
    if (targetUserId === record.createdByUserId) {
      throw new BadRequestException('O criador já tem acesso');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target || !isStudioRole(target.role)) {
      throw new BadRequestException('Usuário inválido');
    }
    const existing = await this.prisma.studioLeadShare.findFirst({
      where: { userId: targetUserId, ...ownerWhere(profileId) },
    });
    if (!existing) {
      await this.prisma.studioLeadShare.create({
        data: {
          ...ownerCreateData(record.kind, profileId),
          userId: targetUserId,
        },
      });
    }
    return this.list(user, profileId);
  }

  async remove(user: JwtUser, profileId: string, targetUserId: string) {
    await this.access.assertCanManageShares(user, profileId);
    await this.prisma.studioLeadShare.deleteMany({
      where: { userId: targetUserId, ...ownerWhere(profileId) },
    });
    return this.list(user, profileId);
  }
}
