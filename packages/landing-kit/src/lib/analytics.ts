export type AnalyticsEvent = {
  event: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer?: AnalyticsEvent[];
  }
}

export function isWhatsappHref(href?: string | null): boolean {
  return /wa\.me|whatsapp|api\.whatsapp/i.test(href || '');
}

export function trackEvent(
  event: string,
  extra: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  const payload: AnalyticsEvent = { event, ...extra };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}
