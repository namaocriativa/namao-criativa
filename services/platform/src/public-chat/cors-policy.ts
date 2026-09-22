import {
  ADMIN_PAGES_PROJECT,
  CLIENT_PAGES_PROJECT,
  DEFAULT_STUDIO_ORIGIN,
  STUDIO_PAGES_PROJECT,
  isPagesProjectOrigin,
  pagesProjectOrigin,
  parseOriginList,
  withWwwAliases,
} from '../auth/cookie-origin';

export const PREVIEW_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:3000',
];

export function isLoopbackHttpOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const local =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return local && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export function allowLoopbackCors(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'production';
}

export function staticCorsOrigins(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const configured = withWwwAliases([
    ...parseOriginList(process.env.NAMAO_PUBLIC_URL),
    ...parseOriginList(process.env.NAMAO_STUDIO_URL),
    ...parseOriginList(process.env.NAMAO_ADMIN_URL),
    DEFAULT_STUDIO_ORIGIN,
    pagesProjectOrigin(STUDIO_PAGES_PROJECT),
    pagesProjectOrigin(CLIENT_PAGES_PROJECT),
    pagesProjectOrigin(ADMIN_PAGES_PROJECT),
  ]);
  if (!allowLoopbackCors(nodeEnv)) return configured.filter(Boolean);
  return [...PREVIEW_ORIGINS, ...configured].filter(Boolean);
}

export function isPreviewOrigin(
  origin?: string | null,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (staticCorsOrigins(nodeEnv).includes(normalized)) return true;
  if (
    isPagesProjectOrigin(normalized, STUDIO_PAGES_PROJECT) ||
    isPagesProjectOrigin(normalized, CLIENT_PAGES_PROJECT) ||
    isPagesProjectOrigin(normalized, ADMIN_PAGES_PROJECT)
  ) {
    return true;
  }
  if (!allowLoopbackCors(nodeEnv)) return false;
  return isLoopbackHttpOrigin(normalized);
}

export function isPublicChatPath(path?: string | null): boolean {
  const pathname = String(path || '').split('?')[0];
  return pathname === '/public/chat' || pathname.startsWith('/public/chat/');
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
