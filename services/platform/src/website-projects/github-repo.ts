export function parseGithubRepo(
  value: unknown,
): { owner: string; name: string; fullName: string } | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/github\.com[:/]([^/]+)\/([^/#?]+)/i);
  const raw = (
    fromUrl ? `${fromUrl[1]}/${fromUrl[2]}` : trimmed
  ).replace(/\.git$/i, '');
  const match = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  return { owner: match[1], name: match[2], fullName: `${match[1]}/${match[2]}` };
}
