export const WEAK_JWT_SECRETS = new Set([
  'dev-jwt-secret-change-me',
  'change-me-in-production',
]);

export function resolveJwtSecret(
  raw: string | undefined | null,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const secret = raw?.trim() || '';
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  if (nodeEnv === 'production' && WEAK_JWT_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET must not use the development placeholder in production',
    );
  }
  return secret;
}
