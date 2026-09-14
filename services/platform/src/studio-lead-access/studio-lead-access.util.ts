import { isStudioAdmin } from '../auth/roles';

export type StudioCreatorPublic = {
  id: string;
  name: string;
  email: string;
};

export type StudioShareRef = {
  userId: string;
};

export type StudioAccessActor = {
  id: string;
  role: string;
};

export type StudioAccessRecord = {
  createdByUserId?: string | null;
  createdBy?: StudioCreatorPublic | null;
  studioShares?: StudioShareRef[];
};

export function visibleWhere(user: StudioAccessActor) {
  if (isStudioAdmin(user.role)) {
    return {};
  }
  return {
    OR: [
      { createdByUserId: user.id },
      { studioShares: { some: { userId: user.id } } },
    ],
  };
}

export function canAccessRecord(
  user: StudioAccessActor,
  record: StudioAccessRecord,
): boolean {
  if (isStudioAdmin(user.role)) return true;
  if (record.createdByUserId === user.id) return true;
  return Boolean(record.studioShares?.some((share) => share.userId === user.id));
}

export function canManageShares(
  user: StudioAccessActor,
  createdByUserId: string | null | undefined,
): boolean {
  return isStudioAdmin(user.role) || createdByUserId === user.id;
}

export function presentStudioProfile<T extends StudioAccessRecord>(
  user: StudioAccessActor,
  record: T,
): Omit<T, 'createdByUserId' | 'createdBy' | 'studioShares'> & {
  sharedWithMe: boolean;
  canManageShares: boolean;
  createdBy?: StudioCreatorPublic | null;
} {
  const { createdByUserId, createdBy, studioShares, ...rest } = record;
  const sharedWithMe =
    createdByUserId !== user.id &&
    Boolean(studioShares?.some((share) => share.userId === user.id));
  const payload = {
    ...(rest as Omit<T, 'createdByUserId' | 'createdBy' | 'studioShares'>),
    sharedWithMe,
    canManageShares: canManageShares(user, createdByUserId),
  };
  if (isStudioAdmin(user.role)) {
    return { ...payload, createdBy: createdBy ?? null };
  }
  return payload;
}
