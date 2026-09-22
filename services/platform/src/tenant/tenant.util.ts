import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { optionalTenantId } from './tenant-context';
import {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_NAME,
  DEFAULT_TENANT_SLUG,
  TENANT_STATUS,
} from './tenant.constants';

export function requireTenantId(): string {
  const tenantId = optionalTenantId();
  if (!tenantId) {
    throw new ForbiddenException('Selecione uma conta para continuar');
  }
  return tenantId;
}

export function tenantWhere<T extends object>(
  extra?: T,
): T & { tenantId: string } {
  return { tenantId: requireTenantId(), ...(extra as T) };
}

export function assertSameTenant<T extends { tenantId?: string | null }>(
  record: T | null | undefined,
  message = 'Registro não encontrado',
): T {
  if (!record) {
    throw new NotFoundException(message);
  }
  const tenantId = optionalTenantId();
  if (tenantId && record.tenantId !== tenantId) {
    throw new NotFoundException(message);
  }
  return record;
}

type TenantClient = {
  findUnique: (args: {
    where: { slug: string };
    select: { id: true };
  }) => Promise<{ id: string } | null>;
  create: (args: {
    data: {
      id: string;
      name: string;
      slug: string;
      status: string;
    };
    select: { id: true };
  }) => Promise<{ id: string }>;
};

export async function resolveDefaultTenantId(prisma: {
  tenant: TenantClient;
}): Promise<string> {
  const existing = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.tenant.create({
    data: {
      id: DEFAULT_TENANT_ID,
      name: DEFAULT_TENANT_NAME,
      slug: DEFAULT_TENANT_SLUG,
      status: TENANT_STATUS.ACTIVE,
    },
    select: { id: true },
  });
  return created.id;
}

export function slugifyTenantName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'conta';
}
