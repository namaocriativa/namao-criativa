export type CloudflareConfig = {
  accountId: string;
  token: string;
};

export class CloudflareError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'CloudflareError';
  }
}

type CfEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
};

export class CloudflareClient {
  constructor(private readonly config: CloudflareConfig) {}

  private url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `https://api.cloudflare.com/client/v4${p}`;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(this.url(path), {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (res.status === 404) {
      throw new CloudflareError('Not found', 404, parsed);
    }

    const envelope = parsed as CfEnvelope<T> | null;
    if (
      !res.ok ||
      (envelope && typeof envelope === 'object' && envelope.success === false)
    ) {
      const msg = cfErrorMessage(envelope, `${method} ${path} → ${res.status}`);
      throw new CloudflareError(msg, res.status, parsed);
    }

    return (envelope?.result ?? parsed) as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  accountPath(suffix: string): string {
    const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `/accounts/${this.config.accountId}${s}`;
  }
}

function cfErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const errors = (body as CfEnvelope<unknown>).errors;
  if (Array.isArray(errors) && errors[0]?.message) {
    return errors.map((e) => e.message).filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

export function createCloudflareClientFromEnv(): CloudflareClient {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required');
  return new CloudflareClient({ accountId, token });
}
