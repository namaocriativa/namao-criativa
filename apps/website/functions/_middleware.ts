import {
  canonicalWebsiteRedirect,
  isApiPath,
  isHtmlNavigation,
  isSameWebsiteOrigin,
  resolveWebsiteApiOrigin,
  rewritePublicOriginHeaders,
} from './proxy-policy';

/**
 * Pages `_redirects` with status 200 to an external origin is ignored
 * (POST /auth/login → 405 on the static asset). Proxy here instead.
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: { WEBSITE_API_ORIGIN?: string };
}): Promise<Response> {
  const { request, next, env } = context;
  const canonical = canonicalWebsiteRedirect(request.url);
  if (
    canonical &&
    (request.method === 'GET' || request.method === 'HEAD')
  ) {
    return Response.redirect(canonical, 301);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const html = isHtmlNavigation(request);

  if (!isApiPath(pathname) || html) {
    return next();
  }

  if (!isSameWebsiteOrigin(request.url, request.headers.get('origin'))) {
    return Response.json({ message: 'Origem não permitida' }, { status: 403 });
  }

  const apiOrigin = resolveWebsiteApiOrigin(env.WEBSITE_API_ORIGIN);
  const target = new URL(pathname + url.search, `${apiOrigin}/`);
  const headers = new Headers(request.headers);
  headers.delete('host');
  rewritePublicOriginHeaders(headers);
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }
  return fetch(target, init);
}
