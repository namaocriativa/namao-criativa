export const PREVIEW_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

export function staticCorsOrigins(): string[] {
  return [
    ...PREVIEW_ORIGINS,
    process.env.NAMAO_PUBLIC_URL?.replace(/\/$/, '') || '',
  ].filter(Boolean);
}

export function isPreviewOrigin(origin?: string | null): boolean {
  if (!origin) return true;
  return staticCorsOrigins().includes(origin.replace(/\/$/, ''));
}

export function originAllowedForLead(
  origin: string | undefined,
  publishedOrigin?: string | null,
): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (isPreviewOrigin(normalized)) return true;
  const published = publishedOrigin?.replace(/\/$/, '') || '';
  return Boolean(published) && normalized === published;
}
