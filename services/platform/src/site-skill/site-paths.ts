const BLOCKED = /(^|\/)(\.\.|node_modules|\.git)(\/|$)/i;

export function assertSafeRelPath(rel: string): string {
  const cleaned = rel.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleaned) throw new Error('caminho vazio');
  if (cleaned.startsWith('/')) throw new Error('caminho absoluto');
  if (BLOCKED.test(cleaned) || cleaned.includes('..')) {
    throw new Error(`caminho fora do projeto: ${rel}`);
  }
  return cleaned;
}
