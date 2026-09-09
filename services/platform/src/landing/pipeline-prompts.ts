import {
  GRAMMAR_TEXT,
  allowedComponentsForType,
  architectPaletteBlock,
  compactCatalogForPrompt,
  palettePromptBlock,
  toLlmCatalog,
  toLlmFeatureCatalog,
  type Architecture,
  type ComponentId,
  type CreativeDirection,
  type FamilyId,
  type GrammarBrief,
  type ThemePayload,
  type ThemeSpec,
} from '@namao/landing-kit';
import {
  sliceBriefForPlan,
  sliceBriefForSection,
  sliceVisionForSection,
} from './brief-slice';
import type {
  LandingSectionConfig,
  LeadBrief,
  VisionAnalysis,
} from './pipeline.types';
import { getPresetSection } from './section-catalog';

const RULES = `Regras obrigatórias:
- Use APENAS dados do brief. Não invente telefone, e-mail, WhatsApp, endereço, depoimentos, números, horários ou URLs.
- Campos em omitted NÃO podem aparecer na UI.
- CTAs somente com hrefs de contacts do brief (tel:, mailto:, wa.me, maps, redes).
- Imagens somente com publicPath listado no brief.
- Vídeos somente com publicPath listado no brief (campos video e portraitVideo).
- Responda SOMENTE JSON válido, sem markdown e sem texto extra.
- NÃO gere React, HTML nem CSS.`;

function jsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildPipelineOverviewPrompt(brief: LeadBrief): string {
  return `# Pipeline de landing (Page Spec)

O scaffold Vite+React já existe em \`${brief.outputDir}/\`.
Gemini NÃO gera código. Gera JSON: direção criativa, arquitetura de componentes e copy.
O sistema valida com Zod e renderiza componentes fechados.

## Brief factual
${jsonBlock(sliceBriefForPlan(brief))}

## Campos omitidos (não usar)
${brief.omitted.join(', ') || '(nenhum)'}

${RULES}
`;
}

export function buildVisionPrompt(brief: LeadBrief): string {
  return `Você analisa imagens reais de um negócio para orientar uma landing page.

Negócio: ${brief.name}
Categoria: ${brief.category || 'não informada'}
Descrição: ${brief.description || 'não informada'}

Olhe as imagens (logo e/ou fotos) e responda SOMENTE JSON válido:
{
  "atmosphere": "clima visual em 1 frase (ex: institucional sóbrio, acolhedor, premium)",
  "colorHints": ["até 4 cores/tons percebidos, ex: azul-marinho", "creme"],
  "logoNotes": "como usar o logo (header, contraste, fundo)",
  "photoNotes": "o que as fotos mostram e onde encaixar (hero/galeria)",
  "heroSuggestion": "sugestão curta de composição do hero sem inventar texto de marketing",
  "avoid": ["o que evitar visualmente, ex: neon", "efeito glass"]
}

Regras:
- Não invente serviços, contatos ou depoimentos.
- Se a imagem for só logo, foque em marca e contraste.
- Seja concreto e curto.`;
}

export function buildPexelsQueryPrompt(
  brief: LeadBrief,
  vision?: VisionAnalysis | null,
): string {
  const visionBlock = vision
    ? `\nAnálise visual:\n${jsonBlock({
        atmosphere: vision.atmosphere,
        heroSuggestion: vision.heroSuggestion,
        photoNotes: vision.photoNotes,
      })}\n`
    : '';

  return `Você escolhe o termo de busca na Pexels para um vídeo stock de atmosfera (B-roll) de landing page.

Negócio: ${brief.name}
Categoria: ${brief.category || 'não informada'}
Serviços: ${(brief.services || []).slice(0, 4).join(', ') || 'não informados'}
Cidade: ${brief.city || 'não informada'}
Descrição: ${brief.description || 'não informada'}
${visionBlock}
Regras:
- query em INGLÊS, 2 a 6 palavras (o acervo Pexels é inglês-first).
- atmosfera do nicho, NUNCA o nome da marca.
- preferir interior / b-roll / workplace; sem texto na tela, logo ou talking-head.
- queryAlt é um plano B um pouco mais genérico do mesmo nicho.

JSON esperado:
{
  "query": "law office interior b-roll",
  "queryAlt": "lawyer desk documents",
  "reason": "nicho advocacia, interior profissional"
}`;
}

export function buildPexelsPickPrompt(opts: {
  brief: LeadBrief;
  candidates: Array<{
    id: number;
    duration: number;
    width: number;
    height: number;
    user: string;
    posterIndex?: number;
  }>;
  vision?: VisionAnalysis | null;
}): string {
  const niche = [
    opts.brief.category,
    (opts.brief.services || []).slice(0, 3).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  const visionLine = opts.vision?.atmosphere
    ? `Atmosfera desejada: ${opts.vision.atmosphere}`
    : '';

  return `Você escolhe UM vídeo stock da Pexels para o hero de "${opts.brief.name}".

Nicho: ${niche || 'não informado'}
${visionLine}

Candidatos (use só estes ids):
${jsonBlock(opts.candidates)}

Critério:
- B-roll do nicho (interior, ofício, atmosfera).
- Rejeite praia/natureza genérica se o nicho for profissional/serviços.
- Rejeite talking-head, logo, texto na tela, vertical.
- Prefira 8–20s, landscape.

Se houver imagens anexadas, posterIndex indica qual still corresponde ao candidato.

JSON esperado:
{
  "videoId": ${opts.candidates[0]?.id || 0},
  "reason": "interior de escritório alinhado ao nicho"
}`;
}

export function buildArtDirectorPrompt(
  brief: LeadBrief,
  vision?: VisionAnalysis | null,
  lockedSections?: LandingSectionConfig[],
  theme?: ThemePayload | null,
): string {
  const visionBlock = vision
    ? `\nAnálise visual das imagens do lead:\n${jsonBlock(vision)}\n`
    : '';
  const sectionsBlock = lockedSections?.length
    ? `\nTipos de seção pedidos pelo usuário (não invente tipos novos):\n${lockedSections
        .map((s) => `- ${s.type} (${s.id}): ${s.title}`)
        .join('\n')}\n`
    : '';
  const paletteBlock = palettePromptBlock(theme);

  return `Você é o Art Director de landing pages. Escolha a direção visual. NÃO escolha componentes e NÃO escreva copy.

${RULES}
${visionBlock}${sectionsBlock}${paletteBlock}
Estilos permitidos: premium, minimal, luxury, modern, corporate, playful, editorial, industrial
Densidade: low | medium
Radius: small | large
Spacing: compact | generous
imageStrategy: large-photography | balanced | minimal

Brief:
${jsonBlock(sliceBriefForPlan(brief))}

JSON esperado:
{
  "style": "premium",
  "visualLanguage": "minimal editorial",
  "colorStrategy": "neutro com acento quente",
  "imageStrategy": "large-photography",
  "density": "low",
  "radius": "large",
  "spacing": "generous",
  "primaryCta": { "label": "WhatsApp", "href": "url do brief" } | null
}`;
}

export function buildPageArchitectPrompt(opts: {
  brief: LeadBrief;
  direction: CreativeDirection;
  lockedSections: LandingSectionConfig[];
  grammar: GrammarBrief;
  features?: Array<{ id: string }>;
  theme?: ThemePayload | null;
}): string {
  const { brief, direction, lockedSections, grammar } = opts;
  const paletteBlock = architectPaletteBlock(opts.theme);
  const catalogRuntime = grammar.runtime === 'premium' ? 'all' : 'lite';
  const chosen = lockedSections.filter((section) => section.component);
  const auto = lockedSections.filter((section) => !section.component);
  const allowed = auto.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    purpose: section.description,
    components: allowedComponentsForType(section.type, grammar),
  }));
  const families = [
    ...new Set(
      [
        ...allowed.flatMap((item) => item.components),
        ...chosen.map((item) => item.component || ''),
      ]
        .map((id) => id.split('.')[0] as FamilyId)
        .filter(Boolean),
    ),
  ];
  const lockedBlock = chosen.length
    ? `\nVariantes JÁ ESCOLHIDAS pelo usuário (não troque o "component"):\n${jsonBlock(
        chosen.map((section) => ({
          id: section.id,
          type: section.type,
          component: section.component,
          purpose: section.description,
        })),
      )}\n`
    : '';

  const featureCatalog = toLlmFeatureCatalog(opts.features?.map((item) => item.id));
  const featuresBlock = featureCatalog.length
    ? `\nAvailable features (choose subset, do not invent ids):\n${featureCatalog
        .map((item) => `- ${item.id}: ${item.llmContract}`)
        .join('\n')}\nNão crie uma seção de chat; o widget é feature, não section.\n`
    : '';

  return `Você é o Page Architect. Escolha UM componente fechado por seção em Auto. NÃO escreva copy. NÃO gere código.

${RULES}

Gramática de layout:
${GRAMMAR_TEXT}

Direção criativa:
${jsonBlock(direction)}
${paletteBlock}
Catálogo (somente estas famílias; runtime=${catalogRuntime}):
${jsonBlock(compactCatalogForPrompt(families, { runtime: catalogRuntime }))}
${lockedBlock}${featuresBlock}
Seções em AUTO (preserve id, type e ordem; só escolha "component" e "purpose"):
${jsonBlock(allowed.length ? allowed : [{ note: 'nenhuma — preserve as variantes já escolhidas' }])}

Brief resumido:
${jsonBlock({
    name: brief.name,
    category: brief.category,
    hasPhotos: grammar.hasPhotos,
    hasServices: grammar.hasServices,
    hasRating: grammar.hasRating,
    hasDescription: grammar.hasDescription,
  })}

JSON esperado:
{
  "sections": [
    { "id": "hero", "type": "hero", "component": "hero.split-image", "purpose": "comunicar valor" }
  ]
}`;
}

export function buildCopywriterPrompt(opts: {
  brief: LeadBrief;
  sectionId: string;
  sectionConfig: LandingSectionConfig;
  component: ComponentId;
  direction: CreativeDirection;
  theme: ThemeSpec;
  previous: Array<{ id: string; preview: string }>;
  issuesToFix?: string[];
  vision?: VisionAnalysis | null;
}): string {
  const {
    brief,
    sectionId,
    sectionConfig,
    component,
    direction,
    previous,
    issuesToFix,
    vision,
  } = opts;
  const type = sectionConfig.type || sectionId;
  const visionSlice = sliceVisionForSection(vision, type);
  const issuesBlock = issuesToFix?.length
    ? `\nCorrija estes problemas (não invente dados novos):\n${issuesToFix
        .map((issue) => `- ${issue}`)
        .join('\n')}\n`
    : '';
  const catalog = toLlmCatalog().find((item) => item.id === component);
  const preset = getPresetSection(type);
  const instruction = preset
    ? `${preset.description}\nInstrução do usuário: ${sectionConfig.description}`
    : `Seção custom "${sectionConfig.title}": ${sectionConfig.description}`;

  return `Você é o Copywriter. Preencha SOMENTE as props do componente "${component}" para a seção "${sectionId}".
NÃO gere HTML, CSS nem React.

${RULES}
${issuesBlock}
Componente:
${jsonBlock(catalog)}

Brief desta seção:
${jsonBlock(sliceBriefForSection(brief, type, {
    visualDirection: direction.visualLanguage,
    tone: direction.colorStrategy,
    primaryCta: direction.primaryCta,
    sections: [sectionId],
    sectionConfigs: [sectionConfig],
    sectionGuides: [],
    notes: '',
  }))}

Direção: style=${direction.style}; ${direction.visualLanguage}

Instrução:
${instruction}

Seções já preenchidas (não repetir ideias):
${previous.length ? previous.map((s) => `- ${s.id}: ${s.preview}`).join('\n') : '(nenhuma)'}

JSON esperado:
{
  "id": "${sectionId}",
  "props": {}
}`;
}

/** @deprecated alias — testes e código legado */
export function buildSectionPrompt(opts: {
  brief: LeadBrief;
  plan: {
    visualDirection: string;
    tone: string;
    primaryCta: { label: string; href: string } | null;
    notes: string;
    sections: string[];
    sectionConfigs: LandingSectionConfig[];
    sectionGuides: unknown[];
  };
  design: { paletteId: string; fontPairId: string };
  sectionId: string;
  sectionConfig: LandingSectionConfig;
  previous: Array<{ id: string; contentPreview: string }>;
  issuesToFix?: string[];
  vision?: VisionAnalysis | null;
}): string {
  return buildCopywriterPrompt({
    brief: opts.brief,
    sectionId: opts.sectionId,
    sectionConfig: opts.sectionConfig,
    component: defaultComponentGuess(opts.sectionConfig.type),
    direction: {
      style: 'modern',
      visualLanguage: opts.plan.visualDirection,
      colorStrategy: opts.plan.tone,
      imageStrategy: 'balanced',
      density: 'medium',
      radius: 'small',
      spacing: 'generous',
      primaryCta: opts.plan.primaryCta,
    },
    theme: {
      style: 'modern',
      visualLanguage: opts.plan.visualDirection,
      colorStrategy: opts.plan.tone,
      imageStrategy: 'balanced',
      density: 'medium',
      radius: 'small',
      spacing: 'generous',
      paletteId: (opts.design.paletteId as 'slate-teal') || 'slate-teal',
      fontPairId: (opts.design.fontPairId as 'fraunces-source') || 'fraunces-source',
      animation: 'none',
    },
    previous: opts.previous.map((item) => ({
      id: item.id,
      preview: item.contentPreview,
    })),
    issuesToFix: opts.issuesToFix,
    vision: opts.vision,
  });
}

function defaultComponentGuess(type: string): ComponentId {
  switch (type) {
    case 'hero':
      return 'hero.split-image';
    case 'services':
      return 'features.cards';
    case 'about':
      return 'about.editorial';
    case 'faq':
      return 'faq.accordion';
    case 'cta':
      return 'cta.banner';
    case 'contact':
      return 'contact.form';
    default:
      return 'content.block';
  }
}

export function buildVisualReviewPrompt(opts: {
  components: string[];
  style: string;
}): string {
  return `Você é um crítico visual de landing pages. Analise o screenshot.

Componentes usados (fechados, nesta ordem):
${opts.components.join(', ')}
Estilo: ${opts.style}

Avalie: hierarquia, whitespace, repetição, contraste, alinhamento, densidade de texto, visibilidade do CTA, qualidade da imagem, ritmo das seções.

Sugestões só podem ser:
- swap-component (trocar para OUTRO id do catálogo da mesma família)
- adjust-props (encurtar texto; nunca inventar fatos)

NÃO sugira CSS. NÃO invente conteúdo.

JSON esperado:
{
  "score": 82,
  "issues": [
    {
      "sectionId": "services",
      "problem": "Muitos cards repetitivos",
      "suggestion": { "kind": "swap-component", "component": "features.bento" }
    }
  ]
}`;
}

export function buildJsonRepairPrompt(raw: string, expected: string): string {
  return `A resposta abaixo deveria ser JSON válido no formato: ${expected}.
Corrija e devolva SOMENTE o JSON válido, sem markdown.

Resposta original:
${raw.slice(0, 12000)}`;
}

export { Architecture, CreativeDirection };
