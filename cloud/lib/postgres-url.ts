const LOCAL_DB_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'host.docker.internal',
]);

export function buildCoolifyPostgresUrl(opts: {
  user: string;
  password: string;
  uuid: string;
  database: string;
}): string {
  const user = encodeURIComponent(opts.user);
  const password = encodeURIComponent(opts.password);
  return `postgresql://${user}:${password}@${opts.uuid}:5432/${opts.database}`;
}

export function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(set)';
  }
}

/** Explicit DATABASE_URL override (managed Postgres). Empty = Coolify will create one. */
export function managedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;
  if (url.startsWith('file:')) {
    throw new Error(
      'DATABASE_URL must be PostgreSQL in cloud (file: SQLite is not reachable from Coolify).',
    );
  }
  try {
    const host = new URL(url).hostname;
    if (LOCAL_DB_HOSTS.has(host)) {
      throw new Error(
        `DATABASE_URL points to "${host}". Unset it so apply creates Coolify Postgres, or set a VPS/internal URL.`,
      );
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(`DATABASE_URL is not a valid URL: ${url}`);
    }
    throw err;
  }
  return url;
}
