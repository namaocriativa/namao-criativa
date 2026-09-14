export type CoolifyConfig = {
  baseUrl: string;
  token: string;
};

export class CoolifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'CoolifyError';
  }
}

export class CoolifyClient {
  constructor(private readonly config: CoolifyConfig) {}

  private url(path: string, query?: Record<string, string | boolean | undefined>) {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const u = new URL(`${base}/api/v1${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === '') continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts?: {
      body?: unknown;
      query?: Record<string, string | boolean | undefined>;
    },
  ): Promise<T> {
    const res = await fetch(this.url(path, opts?.query), {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/json',
        ...(opts?.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const msg =
        typeof body === 'object' &&
        body &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : `Coolify ${method} ${path} → ${res.status}`;
      if (
        typeof body === 'object' &&
        body &&
        'errors' in body
      ) {
        throw new CoolifyError(
          `${msg} ${JSON.stringify((body as { errors: unknown }).errors)}`,
          res.status,
          body,
        );
      }
      throw new CoolifyError(msg, res.status, body);
    }

    return body as T;
  }

  get<T = unknown>(path: string, query?: Record<string, string | boolean | undefined>) {
    return this.request<T>('GET', path, { query });
  }

  post<T = unknown>(path: string, body?: unknown, query?: Record<string, string | boolean | undefined>) {
    return this.request<T>('POST', path, { body, query });
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T = unknown>(path: string, query?: Record<string, string | boolean | undefined>) {
    return this.request<T>('DELETE', path, { query });
  }
}

export function createClientFromEnv(): CoolifyClient {
  const baseUrl = process.env.COOLIFY_BASE_URL?.trim();
  const token = process.env.COOLIFY_API_TOKEN?.trim();
  if (!baseUrl) throw new Error('COOLIFY_BASE_URL is required');
  if (!token) throw new Error('COOLIFY_API_TOKEN is required');
  return new CoolifyClient({ baseUrl, token });
}
