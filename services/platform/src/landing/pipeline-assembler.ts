import type { PageSpec } from '@namao/landing-kit';
import { buildCssVariables, getFontPair, getPalette } from '@namao/landing-kit';
import type {
  DesignSystem,
  GeneratedFile,
  GeneratedSection,
  LandingSectionConfig,
  LeadBrief,
  ReviewResult,
  SectionContentPayload,
  SectionDesignGuide,
  SectionId,
  SitePlan,
  VisionAnalysis,
} from './pipeline.types';
import { PRESET_SECTION_IDS } from './pipeline.types';
import { allowedSectionIds } from './lead-brief';
import { fallbackSectionGuide, getPresetSection } from './section-catalog';
import { buildGtmSnippets, gtmContainerIdFromEnv } from './gtm-snippet';

export function parseVisionAnalysis(value: unknown): VisionAnalysis {
  if (!value || typeof value !== 'object') {
    throw new Error('Análise visual inválida');
  }
  const raw = value as Record<string, unknown>;
  const asStringList = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6)
      : [];

  return {
    atmosphere: String(raw.atmosphere || '').trim() || 'neutro e profissional',
    colorHints: asStringList(raw.colorHints),
    logoNotes: String(raw.logoNotes || '').trim() || 'usar logo no header',
    photoNotes: String(raw.photoNotes || '').trim() || 'sem notas de foto',
    heroSuggestion:
      String(raw.heroSuggestion || '').trim() ||
      'hero com nome e imagem real do brief',
    avoid: asStringList(raw.avoid),
  };
}

function parseGuide(
  raw: unknown,
  fallback: LandingSectionConfig,
): SectionDesignGuide {
  const base = fallbackSectionGuide(fallback);
  if (!raw || typeof raw !== 'object') return base;
  const item = raw as Record<string, unknown>;
  const text = (key: keyof SectionDesignGuide, backup: string) => {
    const value = item[key];
    return typeof value === 'string' && value.trim() ? value.trim() : backup;
  };
  return {
    sectionId: fallback.id,
    layout: text('layout', base.layout),
    visualEmphasis: text('visualEmphasis', base.visualEmphasis),
    hierarchy: text('hierarchy', base.hierarchy),
    imageUse: text('imageUse', base.imageUse),
    spacing: text('spacing', base.spacing),
    cta: text('cta', base.cta),
    notes: text('notes', base.notes),
  };
}

function configsFromIds(ids: SectionId[]): LandingSectionConfig[] {
  return ids.map((id) => {
    const preset = getPresetSection(id);
    return {
      id,
      type: preset?.type || id,
      title: preset?.title || id,
      description: preset?.description || '',
    };
  });
}

export function parseSitePlan(
  value: unknown,
  brief: LeadBrief,
  lockedSections?: LandingSectionConfig[],
): SitePlan {
  if (!value || typeof value !== 'object') {
    throw new Error('Plano inválido');
  }
  const raw = value as Record<string, unknown>;

  let sectionConfigs: LandingSectionConfig[];
  if (lockedSections?.length) {
    sectionConfigs = lockedSections;
  } else {
    const allowed = allowedSectionIds(brief);
    const sections = Array.isArray(raw.sections)
      ? raw.sections
          .map(String)
          .filter((id) =>
            (PRESET_SECTION_IDS as readonly string[]).includes(id),
          )
          .filter((id) => allowed.has(id))
      : [];

    const unique = [...new Set(sections)];
    const used = new Set<string>();
    const ordered: string[] = [];
    const push = (id: string) => {
      if (!used.has(id)) {
        used.add(id);
        ordered.push(id);
      }
    };
    if (!unique.includes('header')) push('header');
    for (const id of unique) push(id);
    if (!unique.includes('hero')) {
      const headerIndex = ordered.indexOf('header');
      ordered.splice(headerIndex + 1, 0, 'hero');
      used.add('hero');
    }
    if (!unique.includes('footer')) push('footer');
    sectionConfigs = configsFromIds(ordered);
  }

  const guidesRaw = Array.isArray(raw.sectionGuides) ? raw.sectionGuides : [];
  const guidesById = new Map<string, unknown>();
  for (const item of guidesRaw) {
    if (!item || typeof item !== 'object') continue;
    const id = String((item as { sectionId?: unknown }).sectionId || '').trim();
    if (id) guidesById.set(id, item);
  }

  const sectionGuides = sectionConfigs.map((section) =>
    parseGuide(guidesById.get(section.id), section),
  );

  let primaryCta: SitePlan['primaryCta'] = null;
  if (raw.primaryCta && typeof raw.primaryCta === 'object') {
    const cta = raw.primaryCta as { label?: unknown; href?: unknown };
    const href = String(cta.href || '').trim();
    const label = String(cta.label || '').trim();
    if (href && label && isAllowedHref(href, brief)) {
      primaryCta = { label, href };
    }
  }

  return {
    visualDirection: String(raw.visualDirection || 'profissional, mobile-first'),
    tone: String(raw.tone || 'institucional'),
    primaryCta,
    sections: sectionConfigs.map((section) => section.id),
    sectionConfigs,
    sectionGuides,
    notes: String(raw.notes || ''),
  };
}

export function parseDesignSystem(value: unknown): DesignSystem {
  if (!value || typeof value !== 'object') {
    throw new Error('Design system inválido');
  }
  const raw = value as Record<string, unknown>;
  const palette = getPalette(
    typeof raw.paletteId === 'string' ? raw.paletteId : undefined,
  );
  const fonts = getFontPair(
    typeof raw.fontPairId === 'string' ? raw.fontPairId : undefined,
  );

  const design: DesignSystem = {
    paletteId: palette.id,
    fontPairId: fonts.id,
    colors: { ...palette.colors },
    fonts: { display: fonts.display, body: fonts.body },
    googleFontsHref: fonts.googleFontsHref,
    spacing: { section: '4.5rem 0' },
    containerMaxWidth: '1080px',
    cssVariables: '',
    baseCss: '',
  };
  design.cssVariables = buildCssVariables(
    { density: 'medium', radius: 'small', spacing: 'generous' },
    palette.colors,
    fonts,
  );
  return design;
}

export function parseGeneratedSection(
  value: unknown,
  expectedId: SectionId,
): GeneratedSection {
  if (!value || typeof value !== 'object') {
    throw new Error(`Seção ${expectedId} inválida`);
  }
  const raw = value as Record<string, unknown>;
  const id = String(raw.id || expectedId);
  if (id !== expectedId) {
    throw new Error(`Seção esperada ${expectedId}, recebida ${id}`);
  }

  const contentRaw =
    raw.content && typeof raw.content === 'object'
      ? (raw.content as Record<string, unknown>)
      : raw;

  const content = normalizeContent(contentRaw);
  const type = typeof raw.type === 'string' ? raw.type : undefined;
  return { id, type, content };
}

function normalizeContent(raw: Record<string, unknown>): SectionContentPayload {
  const content: SectionContentPayload = {};
  if (typeof raw.eyebrow === 'string') content.eyebrow = raw.eyebrow.trim();
  if (typeof raw.title === 'string') content.title = raw.title.trim();
  if (typeof raw.subtitle === 'string') content.subtitle = raw.subtitle.trim();
  if (typeof raw.body === 'string') content.body = raw.body.trim();
  if (typeof raw.ctaLabel === 'string') content.ctaLabel = raw.ctaLabel.trim();
  if (typeof raw.ctaHref === 'string') content.ctaHref = raw.ctaHref.trim();
  if (Array.isArray(raw.items)) {
    content.items = raw.items.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw.imageRefs)) {
    content.imageRefs = raw.imageRefs
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw.nav)) {
    content.nav = raw.nav
      .filter((item): item is { label?: unknown; href?: unknown } =>
        Boolean(item && typeof item === 'object'),
      )
      .map((item) => ({
        label: String(item.label || '').trim(),
        href: String(item.href || '').trim(),
      }))
      .filter((item) => item.label && item.href);
  }
  return content;
}

export function parseReviewResult(value: unknown): ReviewResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Revisão inválida');
  }
  const raw = value as Record<string, unknown>;
  const issues: ReviewResult['issues'] = [];
  if (Array.isArray(raw.issues)) {
    for (const item of raw.issues) {
      if (typeof item === 'string') {
        const problem = item.trim();
        if (problem) issues.push({ sectionId: '', problem });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const row = item as {
        sectionId?: unknown;
        field?: unknown;
        problem?: unknown;
      };
      const problem = String(row.problem || '').trim();
      if (!problem) continue;
      const field = String(row.field || '').trim();
      issues.push({
        sectionId: String(row.sectionId || '').trim(),
        ...(field ? { field } : {}),
        problem,
      });
    }
  }

  return {
    approved: Boolean(raw.approved) && issues.length === 0,
    issues,
  };
}

export function assembleLandingFiles(opts: {
  brief: LeadBrief;
  spec: PageSpec;
  publicSiteId?: string;
  apiBase?: string;
  gtmContainerId?: string;
  leadId?: string;
  landingSlug?: string;
}): GeneratedFile[] {
  const { brief, spec } = opts;
  const palette = getPalette(spec.theme.paletteId);
  const fonts = getFontPair(spec.theme.fontPairId);
  const cssVariables = buildCssVariables(spec.theme, palette.colors, fonts);

  const fontLink = fonts.googleFontsHref
    ? `    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${escapeAttr(fonts.googleFontsHref)}" rel="stylesheet" />`
    : '';

  const overlayCss = spec.overlays.map((item) => item.css).filter(Boolean).join('\n');
  const overlayHtml = spec.overlays.map((item) => item.html).filter(Boolean).join('\n');
  const overlayJs = spec.overlays.map((item) => item.js).filter(Boolean).join('\n');
  const discoveryBoot = opts.publicSiteId
    ? `    <script>window.LEAD_DISCOVERY=${JSON.stringify({
        siteId: opts.publicSiteId,
        apiBase: opts.apiBase || '',
      }).replace(/</g, '\\u003c')}</script>`
    : '';

  const gtm = buildGtmSnippets({
    containerId: opts.gtmContainerId ?? gtmContainerIdFromEnv(),
    leadId: opts.leadId || brief.leadId,
    siteId: opts.publicSiteId,
    landingSlug: opts.landingSlug || brief.slug,
  });
  const gtmHead = gtm ? `    ${gtm.head}\n` : '';
  const gtmBody = gtm ? `    ${gtm.body}\n` : '';

  const indexHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(brief.name)}</title>
    <meta name="description" content="${escapeAttr(metaDescription(brief))}" />
${fontLink}
    ${overlayCss ? `<style>${overlayCss}</style>` : ''}
${gtmHead}  </head>
  <body>
${gtmBody}    <div id="root"></div>
    ${overlayHtml}
${discoveryBoot}
    <script type="module" src="/src/main.tsx"></script>
    ${overlayJs ? `<script>${overlayJs}</script>` : ''}
  </body>
</html>
`;

  const mainTsx = `import { createRoot } from 'react-dom/client';
import App from './App';
import '../vendor/landing-kit/styles.css';
import '../vendor/landing-kit/theme/tailwind.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(<App />);
`;

  const appTsx = `import spec from '../page-spec.json';
import { LandingPage } from '../vendor/landing-kit/renderer';

export default function App() {
  return <LandingPage spec={spec} />;
}
`;

  const needsThree = spec.sections.some(
    (section) => section.component === 'hero.immersive',
  );

  const packageJson = JSON.stringify(
    {
      name: brief.slug,
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.2.8',
        'react-dom': '^19.2.8',
        zod: '^3.24.2',
        motion: '^12.23.12',
        gsap: '^3.13.0',
        lenis: '^1.3.11',
        ...(needsThree
          ? {
              three: '^0.179.1',
              '@react-three/fiber': '^9.3.0',
              '@react-three/drei': '^10.7.4',
            }
          : {}),
      },
      devDependencies: {
        '@types/react': '^19.2.18',
        '@types/react-dom': '^19.2.4',
        '@vitejs/plugin-react': '^4.7.0',
        '@tailwindcss/vite': '^4.1.12',
        tailwindcss: '^4.1.12',
        typescript: '^5.7.3',
        vite: '^6.3.5',
      },
    },
    null,
    2,
  );

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
`;

  const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false
  },
  "include": ["src", "vendor", "page-spec.json"]
}
`;

  const readme = `# ${brief.name}

Projeto Vite + React gerado a partir do enrichment (Page Spec + componentes fechados).

## Dev

\`\`\`bash
cd ${brief.outputDir}
npm install
npm run dev
\`\`\`

## Deploy Vercel

Pasta local: \`${brief.outputDir}\`.

O server publica o \`dist/\` automaticamente depois do build quando \`VERCEL_TOKEN\` está no \`.env\`.
Também dá para republicar pelo botão **Publicar na Vercel** na página do lead.
`;

  return [
    { path: 'index.html', content: indexHtml },
    { path: 'src/main.tsx', content: mainTsx },
    { path: 'src/App.tsx', content: appTsx },
    { path: 'src/theme.css', content: cssVariables },
    { path: 'src/vite-env.d.ts', content: '/// <reference types="vite/client" />\n' },
    { path: 'page-spec.json', content: JSON.stringify(spec, null, 2) },
    { path: 'package.json', content: `${packageJson}\n` },
    { path: 'vite.config.js', content: viteConfig },
    { path: 'tsconfig.json', content: tsconfig },
    { path: 'README.md', content: readme },
  ];
}

export function isAllowedHref(href: string, brief: LeadBrief): boolean {
  const contacts = brief.contacts;
  const allowed = [
    contacts.phone ? `tel:${contacts.phone.replace(/\s/g, '')}` : '',
    contacts.whatsappUrl || '',
    contacts.email ? `mailto:${contacts.email}` : '',
    contacts.website || '',
    contacts.instagram || '',
    contacts.facebook || '',
    contacts.linkedin || '',
    contacts.mapsUrl || '',
  ].filter(Boolean);

  if (href.startsWith('#')) return true;
  return allowed.some((item) => href === item || href.startsWith(item));
}

function metaDescription(brief: LeadBrief): string {
  const loc = [brief.city, brief.state].filter(Boolean).join(', ');
  return loc ? `${brief.name} — ${loc}` : brief.name;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll('"', '&quot;');
}
