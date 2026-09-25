export type OwnerKind = 'lead' | 'customer';

export type OwnerFk = {
  leadId?: string | null;
  customerId?: string | null;
};

export function ownerWhere(id: string): { OR: Array<{ leadId: string } | { customerId: string }> } {
  return { OR: [{ leadId: id }, { customerId: id }] };
}

export function ownerCreateData(kind: OwnerKind, id: string): {
  leadId: string | null;
  customerId: string | null;
} {
  return kind === 'lead'
    ? { leadId: id, customerId: null }
    : { leadId: null, customerId: id };
}

export function ownerIdOf(row: OwnerFk): string | null {
  return row.customerId || row.leadId || null;
}

export function jwtOwnerId(user: {
  leadId?: string | null;
  customerId?: string | null;
}): string | null {
  return user.customerId || user.leadId || null;
}

export const STUDIO_CREATOR_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

export const PROFILE_DETAIL_INCLUDE = {
  images: {
    orderBy: { createdAt: 'asc' as const },
  },
  sources: {
    orderBy: { createdAt: 'asc' as const },
  },
  createdBy: {
    select: STUDIO_CREATOR_SELECT,
  },
  studioShares: {
    select: { userId: true },
  },
  clientAccounts: {
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  },
  invites: {
    orderBy: { createdAt: 'desc' as const },
    take: 5,
    select: {
      id: true,
      status: true,
      phone: true,
      expiresAt: true,
      createdAt: true,
    },
  },
  instagramConnections: {
    select: {
      id: true,
      username: true,
      igUserId: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
  },
};

export const PROFILE_LIST_INCLUDE = {
  _count: {
    select: {
      images: true,
      sources: true,
    },
  },
  createdBy: {
    select: STUDIO_CREATOR_SELECT,
  },
  studioShares: {
    select: { userId: true },
  },
};

export function withPortalUsers<
  T extends {
    clientAccounts?: ReadonlyArray<{
      id: string;
      email: string;
      name: string;
      createdAt?: Date | string;
    }>;
  },
>(row: T) {
  const accounts = row.clientAccounts || [];
  return {
    ...row,
    users: accounts.map((account) => ({ ...account, role: 'CLIENT' as const })),
  };
}

export const PROFILE_SCALAR_SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  phone: true,
  whatsapp: true,
  email: true,
  website: true,
  address: true,
  city: true,
  state: true,
  country: true,
  instagram: true,
  facebook: true,
  linkedin: true,
  services: true,
  metadata: true,
  generateConfig: true,
  landingSlug: true,
  landingStatus: true,
  landingBuiltAt: true,
  activeLandingJobId: true,
  publicSiteId: true,
  chatEnabled: true,
  publishedOrigin: true,
  vercelProjectId: true,
  vercelDeploymentId: true,
  websiteProjectId: true,
  websiteDeployType: true,
  websiteRepo: true,
  websiteFramework: true,
  websiteDomain: true,
  fromPublicSignup: true,
  createdAt: true,
  updatedAt: true,
} as const;
