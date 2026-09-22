export const CALENDAR_PLATFORMS = ['instagram', 'youtube', 'tiktok'] as const;

export type CalendarPlatform = (typeof CALENDAR_PLATFORMS)[number];

export const CALENDAR_POST_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;

export const CALENDAR_TARGET_STATUS = {
  PENDING: 'pending',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  READY_MANUAL: 'ready_manual',
  NEEDS_CONNECTION: 'needs_connection',
} as const;

export function isCalendarPlatform(value: string): value is CalendarPlatform {
  return (CALENDAR_PLATFORMS as readonly string[]).includes(value);
}

export function uniquePlatforms(values: string[]): CalendarPlatform[] {
  const seen = new Set<CalendarPlatform>();
  for (const value of values) {
    if (!isCalendarPlatform(value) || seen.has(value)) continue;
    seen.add(value);
  }
  return [...seen];
}

export function recomputePostStatus(
  targets: { status: string }[],
): (typeof CALENDAR_POST_STATUS)[keyof typeof CALENDAR_POST_STATUS] {
  if (!targets.length) return CALENDAR_POST_STATUS.DRAFT;
  const statuses = targets.map((target) => target.status);
  if (statuses.every((status) => status === CALENDAR_TARGET_STATUS.PUBLISHED)) {
    return CALENDAR_POST_STATUS.PUBLISHED;
  }
  if (statuses.some((status) => status === CALENDAR_TARGET_STATUS.PUBLISHING)) {
    return CALENDAR_POST_STATUS.PUBLISHING;
  }
  if (statuses.every((status) => status === CALENDAR_TARGET_STATUS.FAILED)) {
    return CALENDAR_POST_STATUS.FAILED;
  }
  if (statuses.some((status) => status === CALENDAR_TARGET_STATUS.PUBLISHED)) {
    return CALENDAR_POST_STATUS.PARTIAL;
  }
  if (
    statuses.some(
      (status) =>
        status === CALENDAR_TARGET_STATUS.READY_MANUAL ||
        status === CALENDAR_TARGET_STATUS.NEEDS_CONNECTION,
    )
  ) {
    return CALENDAR_POST_STATUS.PARTIAL;
  }
  return CALENDAR_POST_STATUS.SCHEDULED;
}
