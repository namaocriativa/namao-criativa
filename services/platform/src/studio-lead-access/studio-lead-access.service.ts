import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.strategy';
import type { OwnerKind } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { optionalTenantId } from '../tenant/tenant-context';
import {
  canAccessRecord,
  canManageShares,
  presentStudioProfile,
  visibleWhere,
  type StudioAccessRecord,
} from './studio-lead-access.util';

const ACCESS_SELECT = {
  id: true,
  tenantId: true,
  createdByUserId: true,
  studioShares: { select: { userId: true } },
} as const;

export type StudioProfileAccess = {
  kind: OwnerKind;
  id: string;
  tenantId: string;
  createdByUserId: string | null;
  studioShares: { userId: string }[];
};

@Injectable()
export class StudioLeadAccessService {
  constructor(private readonly prisma: PrismaService) {}

  visibleWhere(user: JwtUser) {
    return visibleWhere(user);
  }

  present<T extends StudioAccessRecord>(user: JwtUser, record: T) {
    return presentStudioProfile(user, record);
  }

  async loadRecord(profileId: string): Promise<StudioProfileAccess | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: profileId },
      select: ACCESS_SELECT,
    });
    if (lead) {
      const tenantId = optionalTenantId();
      if (tenantId && lead.tenantId !== tenantId) return null;
      return { kind: 'lead', ...lead };
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: profileId },
      select: ACCESS_SELECT,
    });
    if (customer) {
      const tenantId = optionalTenantId();
      if (tenantId && customer.tenantId !== tenantId) return null;
      return { kind: 'customer', ...customer };
    }
    return null;
  }

  async hasAccess(user: JwtUser, profileId: string): Promise<boolean> {
    const record = await this.loadRecord(profileId);
    return Boolean(record && canAccessRecord(user, record));
  }

  async assertCanAccess(
    user: JwtUser,
    profileId: string,
  ): Promise<StudioProfileAccess> {
    const record = await this.loadRecord(profileId);
    if (!record || !canAccessRecord(user, record)) {
      throw new NotFoundException(`Perfil ${profileId} não encontrado`);
    }
    return record;
  }

  async assertCanManageShares(
    user: JwtUser,
    profileId: string,
  ): Promise<StudioProfileAccess> {
    const record = await this.assertCanAccess(user, profileId);
    if (!canManageShares(user, record.createdByUserId)) {
      throw new ForbiddenException(
        'Apenas o criador ou um admin pode gerenciar o compartilhamento',
      );
    }
    return record;
  }
}
