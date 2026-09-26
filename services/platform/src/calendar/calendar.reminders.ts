export const CALENDAR_REMINDER_STATUSES = ['open', 'done'] as const;

export type CalendarReminderStatus =
  (typeof CALENDAR_REMINDER_STATUSES)[number];

export function isCalendarReminderStatus(
  value: string,
): value is CalendarReminderStatus {
  return (CALENDAR_REMINDER_STATUSES as readonly string[]).includes(value);
}
