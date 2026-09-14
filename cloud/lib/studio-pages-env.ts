export const STUDIO_PAGES_REQUIRED_ENV = ['JWT_SECRET', 'STUDIO_API_ORIGIN'] as const;

export type PagesEnvVar = { type?: string; value?: string };

export type PagesProjectEnv = {
  deployment_configs?: {
    production?: {
      env_vars?: Record<string, PagesEnvVar | undefined>;
    };
  };
};

export function productionEnvKeys(project: PagesProjectEnv): string[] {
  const vars = project.deployment_configs?.production?.env_vars || {};
  return Object.keys(vars).filter((key) => {
    const entry = vars[key];
    if (!entry) return false;
    if (entry.type === 'secret_text') return true;
    return Boolean(entry.value?.trim());
  });
}

export function assertStudioPagesEnv(keys: string[]): void {
  const missing = STUDIO_PAGES_REQUIRED_ENV.filter((key) => !keys.includes(key));
  if (missing.length) {
    throw new Error(
      `Cloudflare Pages production env missing ${missing.join(', ')} — run cloud:studio / cloud:apply first`,
    );
  }
}
