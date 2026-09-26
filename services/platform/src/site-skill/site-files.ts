import { assertSafeRelPath } from './site-paths';

export type SiteFilesSpec = {
  files: Record<string, string>;
  extraDeps?: string[];
};

export function parseSiteFiles(value: unknown): SiteFilesSpec {
  if (!value || typeof value !== 'object') {
    throw new Error('resposta sem arquivos');
  }
  const raw = (value as { files?: unknown }).files;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('files inválido');
  }
  const files: Record<string, string> = {};
  for (const [key, content] of Object.entries(raw)) {
    const path = assertSafeRelPath(key);
    if (typeof content !== 'string') {
      throw new Error(`arquivo ${path} não é texto`);
    }
    files[path] = content;
  }
  if (!Object.keys(files).length) throw new Error('nenhum arquivo gerado');
  const extraDeps = Array.isArray((value as { extraDeps?: unknown }).extraDeps)
    ? ((value as { extraDeps: unknown[] }).extraDeps)
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  return { files, extraDeps };
}

export function buildSiteCodePrompt(opts: {
  prompt: string;
  slug: string;
  imageNames: string[];
}): string {
  return `Você é um engenheiro front-end. Gere um site Vite + React + TypeScript a partir do prompt.

O scaffold já existe (index.html, src/main.tsx, src/App.tsx, src/index.css, package.json).
Devolva SOMENTE JSON:
{ "files": { "caminho/relativo": "conteúdo" }, "extraDeps": ["motion", "three"] }

Regras:
- Só paths relativos ao projeto. Sem node_modules, sem .git, sem ..
- Inclua src/App.tsx, src/index.css, index.html e o que mais precisar.
- Imagens em public/ já estarão em: ${opts.imageNames.join(', ') || '(nenhuma)'}
- Vídeos mencionados no prompt devem usar /video1.mp4 e /video2.mp4 se existirem.
- SEO: title, description, Open Graph.
- Conversão: CTA com WhatsApp/contato do prompt, sem inventar dados.
- Slug do projeto: ${opts.slug}

## Prompt do site
${opts.prompt}`;
}
