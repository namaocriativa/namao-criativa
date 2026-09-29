export const CONTENT_PLAN_OBJECTIVES = [
  'followers',
  'leads',
  'sales',
  'engagement',
  'brand',
  'educate',
  'launch',
] as const;

export type ContentPlanObjective = (typeof CONTENT_PLAN_OBJECTIVES)[number];

export const CONTENT_PLAN_OBJECTIVE_LABELS: Record<ContentPlanObjective, string> = {
  followers: 'Aumentar seguidores',
  leads: 'Gerar leads e contatos',
  sales: 'Vender produtos ou serviços',
  engagement: 'Aumentar o engajamento',
  brand: 'Fortalecer a marca',
  educate: 'Educar o público',
  launch: 'Divulgar um lançamento',
};

export const CONTENT_PLAN_TONES = [
  'professional',
  'close',
  'fun',
  'sophisticated',
  'educational',
  'provocative',
] as const;

export type ContentPlanTone = (typeof CONTENT_PLAN_TONES)[number];

export const CONTENT_PLAN_TONE_LABELS: Record<ContentPlanTone, string> = {
  professional: 'Profissional',
  close: 'Próximo e humano',
  fun: 'Divertido',
  sophisticated: 'Sofisticado',
  educational: 'Educativo',
  provocative: 'Provocativo',
};

export const CONTENT_PLAN_MIX_MODES = ['ai', 'balanced'] as const;
export type ContentPlanMixMode = (typeof CONTENT_PLAN_MIX_MODES)[number];

export const CONTENT_PLAN_JOURNEY = [
  'problem',
  'educate',
  'proof',
  'convert',
] as const;

export type ContentPlanJourney = (typeof CONTENT_PLAN_JOURNEY)[number];

export const CONTENT_PLAN_JOURNEY_LABELS: Record<ContentPlanJourney, string> = {
  problem: 'Problema',
  educate: 'Educação',
  proof: 'Prova social',
  convert: 'Conversão',
};

export type ContentPlanFormat = 'carousel' | 'reel' | 'static';

export const CONTENT_PLAN_ITEM_STATUSES = [
  'draft',
  'selected',
  'dropped',
  'created',
  'scheduled',
] as const;

export type ContentPlanItemStatus = (typeof CONTENT_PLAN_ITEM_STATUSES)[number];

export const CONTENT_PLAN_TOOLS = ['carousel', 'image', 'video'] as const;
export type ContentPlanTool = (typeof CONTENT_PLAN_TOOLS)[number];

export const CONTENT_PLAN_STUDIO_SOURCES = ['image-studio', 'video-studio'] as const;
export type ContentPlanStudioSource = (typeof CONTENT_PLAN_STUDIO_SOURCES)[number];

export type ContentPlanContextOverrides = {
  segment?: string;
  audience?: string;
  voice?: string;
};

export type ContentPlanFormBrief = {
  title: string;
  objectives: ContentPlanObjective[];
  goalNote: string;
  tones: ContentPlanTone[];
  promote: string;
  avoid: string;
  formatMix: ContentPlanMixMode;
  startsOn: string;
  contextOverrides: ContentPlanContextOverrides;
  usePreviousPlan: boolean;
};

export type ContentPlanStrategy = {
  summary: string;
  objectives: string[];
  audience: { current: string; intended: string };
  pillars: Array<{ name: string; role: string }>;
  messages: string[];
  mix: string;
  sequence: string;
  goals: Array<{ label: string; note: string }>;
};

export type ContentPlanVideoTake = {
  id: string;
  label: string;
  beat: string;
  productionPrompt: string;
  studioAssetId?: string;
};

export const MIN_VIDEO_TAKES = 2;
export const MAX_VIDEO_TAKES = 5;

export type ContentPlanItem = {
  id: string;
  week: number;
  scheduledAt: string;
  format: ContentPlanFormat;
  objective: string;
  pillar: string;
  journeyStage: ContentPlanJourney;
  title: string;
  hook: string;
  caption: string;
  structure: string[];
  visualDirection: string;
  cta: string;
  status: ContentPlanItemStatus;
  tool?: ContentPlanTool;
  studioSource?: ContentPlanStudioSource;
  studioProjectId?: string;
  studioAssetIds?: string[];
  previewUrls?: string[];
  selectedStudioAssetId?: string;
  calendarPostId?: string;
  characterId?: string;
  characterAssetId?: string;
  videoHookId?: string;
  videoTakes?: ContentPlanVideoTake[];
};

export type ContentPlanClientContext = {
  username: string | null;
  analyzedAt: string | null;
  igJobId: string;
  identified: {
    postCount: number;
    postsPerWeek: number;
    windowDays: number;
    mix: { image: number; video: number; carousel: number; other: number };
    themes: string[];
    hashtags: string[];
    ctas: string[];
  };
  inferred: {
    segment: string;
    audience: string;
    voice: string[];
    pillars: string[];
    gaps: string[];
    stage: string;
  };
  suggestedTones: ContentPlanTone[];
  lead: {
    name: string;
    category: string | null;
    city: string | null;
    services: string[];
  };
};

const TONE_HINTS: Array<[ContentPlanTone, string[]]> = [
  ['professional', ['profissional', 'formal', 'tecnico', 'técnico']],
  ['close', ['proximo', 'próximo', 'humano', 'direto', 'local', 'acolhedor']],
  ['fun', ['divertido', 'leve', 'descontraido', 'descontraído', 'humor']],
  ['sophisticated', ['sofisticado', 'elegante', 'premium']],
  ['educational', ['educativo', 'didatico', 'didático', 'explicativo']],
  ['provocative', ['provocativo', 'ousado', 'irreverente']],
];

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function suggestTonesFromVoice(adjectives: string[]): ContentPlanTone[] {
  const hits = new Set<ContentPlanTone>();
  for (const adjective of adjectives) {
    const needle = fold(adjective);
    for (const [tone, hints] of TONE_HINTS) {
      if (hints.some((hint) => needle.includes(fold(hint)))) hits.add(tone);
    }
  }
  const next = [...hits].slice(0, 3);
  return next.length ? next : ['professional', 'close'];
}

export function parseObjectives(value: unknown): ContentPlanObjective[] {
  const raw = Array.isArray(value) ? value : [];
  const next = raw
    .map((item) => String(item || '').trim())
    .filter((item): item is ContentPlanObjective =>
      (CONTENT_PLAN_OBJECTIVES as readonly string[]).includes(item),
    );
  return [...new Set(next)].slice(0, 3);
}

export function parseTones(value: unknown): ContentPlanTone[] {
  const raw = Array.isArray(value) ? value : [];
  const next = raw
    .map((item) => String(item || '').trim())
    .filter((item): item is ContentPlanTone =>
      (CONTENT_PLAN_TONES as readonly string[]).includes(item),
    );
  return [...new Set(next)].slice(0, 4);
}

export function parseMixMode(value: unknown): ContentPlanMixMode {
  const raw = String(value || '').trim();
  return raw === 'balanced' ? 'balanced' : 'ai';
}

export function parseJourney(value: unknown, fallback: ContentPlanJourney): ContentPlanJourney {
  const raw = String(value || '').trim();
  if ((CONTENT_PLAN_JOURNEY as readonly string[]).includes(raw)) {
    return raw as ContentPlanJourney;
  }
  return fallback;
}

export function defaultPlanTitle(objectives: ContentPlanObjective[], now = new Date()): string {
  const month = now.toLocaleDateString('pt-BR', { month: 'long' });
  const labels = objectives
    .map((item) => CONTENT_PLAN_OBJECTIVE_LABELS[item])
    .filter(Boolean)
    .slice(0, 2);
  const head = labels.length ? labels.join(' · ') : 'Planejamento';
  return `${head} · ${month}`;
}

export function parseItemStatus(
  value: unknown,
  fallback: ContentPlanItemStatus = 'draft',
): ContentPlanItemStatus {
  const raw = String(value || '').trim();
  if ((CONTENT_PLAN_ITEM_STATUSES as readonly string[]).includes(raw)) {
    return raw as ContentPlanItemStatus;
  }
  return fallback;
}

export function parseTool(value: unknown): ContentPlanTool | undefined {
  const raw = String(value || '').trim();
  if ((CONTENT_PLAN_TOOLS as readonly string[]).includes(raw)) {
    return raw as ContentPlanTool;
  }
  return undefined;
}

export function toolForFormat(format: ContentPlanFormat): ContentPlanTool {
  if (format === 'static') return 'image';
  if (format === 'reel') return 'video';
  return 'carousel';
}

export function studioSourceForTool(tool: ContentPlanTool): ContentPlanStudioSource {
  return tool === 'video' ? 'video-studio' : 'image-studio';
}

export function toolLabel(tool: ContentPlanTool): string {
  if (tool === 'image') return 'Imagens 4:5';
  if (tool === 'video') return 'Vídeo livre';
  return 'Carrossel Instagram';
}

export function parsePlanItems(value: unknown): ContentPlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((row, index) => parsePlanItem(row, index));
}

export function parsePlanItem(value: unknown, index = 0): ContentPlanItem {
  const row =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const format = parseStoredFormat(row.format);
  const tool = parseTool(row.tool);
  const sourceRaw = String(row.studioSource || '').trim();
  const studioSource = (CONTENT_PLAN_STUDIO_SOURCES as readonly string[]).includes(
    sourceRaw,
  )
    ? (sourceRaw as ContentPlanStudioSource)
    : undefined;
  const studioAssetIds = stringIds(row.studioAssetIds);
  const previewUrls = stringIds(row.previewUrls);
  const studioProjectId = textId(row.studioProjectId);
  const selectedStudioAssetId = textId(row.selectedStudioAssetId);
  const calendarPostId = textId(row.calendarPostId);
  const characterId = textId(row.characterId);
  const characterAssetId = textId(row.characterAssetId);
  const videoHookId = textId(row.videoHookId);
  const videoTakes = parseVideoTakes(row.videoTakes);
  return {
    id: String(row.id || `cp-${index + 1}`),
    week: Number(row.week) > 0 ? Math.round(Number(row.week)) : 1,
    scheduledAt: String(row.scheduledAt || ''),
    format,
    objective: String(row.objective || ''),
    pillar: String(row.pillar || ''),
    journeyStage: parseJourney(row.journeyStage, 'educate'),
    title: String(row.title || ''),
    hook: String(row.hook || ''),
    caption: String(row.caption || ''),
    structure: Array.isArray(row.structure)
      ? row.structure.map((step) => String(step || '')).filter(Boolean)
      : [],
    visualDirection: String(row.visualDirection || ''),
    cta: String(row.cta || ''),
    status: parseItemStatus(row.status),
    ...(tool ? { tool } : {}),
    ...(studioSource ? { studioSource } : {}),
    ...(studioProjectId ? { studioProjectId } : {}),
    ...(studioAssetIds.length ? { studioAssetIds } : {}),
    ...(previewUrls.length ? { previewUrls } : {}),
    ...(selectedStudioAssetId && studioAssetIds.includes(selectedStudioAssetId)
      ? { selectedStudioAssetId }
      : {}),
    ...(calendarPostId ? { calendarPostId } : {}),
    ...(characterId ? { characterId } : {}),
    ...(characterId && characterAssetId ? { characterAssetId } : {}),
    ...(videoHookId ? { videoHookId } : {}),
    ...(videoTakes.length ? { videoTakes } : {}),
  };
}

export function markItemsSelected(items: ContentPlanItem[]): ContentPlanItem[] {
  return items.map((item) =>
    item.status === 'draft' ? { ...item, status: 'selected' } : item,
  );
}

export function applyItemSelection(
  items: ContentPlanItem[],
  keepIds: unknown,
): ContentPlanItem[] {
  const keep = new Set(
    (Array.isArray(keepIds) ? keepIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  );
  return items.map((item) => {
    if (item.status === 'created' || item.status === 'scheduled') return item;
    return { ...item, status: keep.has(item.id) ? 'selected' : 'dropped' };
  });
}

export function buildItemProductionPrompt(item: ContentPlanItem): string {
  const structure = (item.structure || [])
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
  return [
    item.title ? `Título: ${item.title}` : '',
    item.hook ? `Hook: ${item.hook}` : '',
    structure ? `Estrutura:\n${structure}` : '',
    item.visualDirection ? `Direção visual: ${item.visualDirection}` : '',
    item.cta ? `CTA: ${item.cta}` : '',
    item.caption ? `Legenda: ${item.caption}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function clampVideoTakeCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_VIDEO_TAKES;
  return Math.min(MAX_VIDEO_TAKES, Math.max(MIN_VIDEO_TAKES, n));
}

export function parseVideoTakes(value: unknown): ContentPlanVideoTake[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const takes: ContentPlanVideoTake[] = [];
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const id = textId(item.id) || `take-${index + 1}`;
    if (seen.has(id)) continue;
    const label = String(item.label || '').trim().slice(0, 120);
    const beat = String(item.beat || '').trim().slice(0, 400);
    const productionPrompt = String(item.productionPrompt || '')
      .trim()
      .slice(0, 4000);
    if (!label || !beat || !productionPrompt) continue;
    seen.add(id);
    const studioAssetId = textId(item.studioAssetId);
    takes.push({
      id,
      label,
      beat,
      productionPrompt,
      ...(studioAssetId ? { studioAssetId } : {}),
    });
    if (takes.length >= MAX_VIDEO_TAKES) break;
  }
  return takes;
}

/** Resolve which planned take to generate next (or by id). */
export function resolveVideoTakeToGenerate(
  item: ContentPlanItem,
  takeId?: string | null,
): ContentPlanVideoTake | undefined {
  const takes = item.videoTakes || [];
  if (!takes.length) return undefined;
  const requested = String(takeId || '').trim();
  if (requested) {
    return takes.find((take) => take.id === requested);
  }
  return takes.find((take) => !take.studioAssetId);
}

export function linkVideoTakeAsset(
  takes: ContentPlanVideoTake[] | undefined,
  takeId: string,
  studioAssetId: string,
): ContentPlanVideoTake[] | undefined {
  if (!takes?.length) return takes;
  const assetId = String(studioAssetId || '').trim();
  const id = String(takeId || '').trim();
  if (!assetId || !id) return takes;
  return takes.map((take) =>
    take.id === id ? { ...take, studioAssetId: assetId } : take,
  );
}

export function previewUrlForAsset(localPath: string | null | undefined): string {
  const path = String(localPath || '')
    .trim()
    .replace(/^\/+/, '');
  return path ? `/${path}` : '';
}

export function previewMediaFromAssets(
  assets: Array<{ id?: string | null; localPath?: string | null }>,
): { studioAssetIds: string[]; previewUrls: string[] } {
  const rows = assets
    .map((asset) => ({
      id: String(asset.id || '').trim(),
      preview: previewUrlForAsset(asset.localPath),
    }))
    .filter((row) => row.id);
  return {
    studioAssetIds: rows.map((row) => row.id),
    previewUrls: rows.map((row) => row.preview).filter(Boolean),
  };
}

/** Acumula takes de vídeo sem apagar as anteriores; seleciona a mais nova. */
export function appendVideoTakes(
  current: Pick<ContentPlanItem, 'studioAssetIds' | 'previewUrls'>,
  generated: { studioAssetIds: string[]; previewUrls: string[] },
): {
  studioAssetIds: string[];
  previewUrls: string[];
  selectedStudioAssetId: string;
} {
  const seen = new Set(stringIds(current.studioAssetIds));
  const studioAssetIds = [...seen];
  const previewById = new Map<string, string>();
  const previousIds = stringIds(current.studioAssetIds);
  const previousUrls = stringIds(current.previewUrls);
  previousIds.forEach((id, index) => {
    const url = previousUrls[index];
    if (url) previewById.set(id, url);
  });
  let selectedStudioAssetId = previousIds[previousIds.length - 1] || '';
  generated.studioAssetIds.forEach((id, index) => {
    const key = String(id || '').trim();
    if (!key) return;
    if (!seen.has(key)) {
      seen.add(key);
      studioAssetIds.push(key);
    }
    const url = generated.previewUrls[index];
    if (url) previewById.set(key, url);
    selectedStudioAssetId = key;
  });
  return {
    studioAssetIds,
    previewUrls: studioAssetIds
      .map((id) => previewById.get(id) || '')
      .filter(Boolean),
    selectedStudioAssetId,
  };
}

export function scheduleAssetIds(item: ContentPlanItem): string[] {
  const ids = item.studioAssetIds || [];
  if (!ids.length) return [];
  if (item.format === 'reel' || item.tool === 'video') {
    const selected = String(item.selectedStudioAssetId || '').trim();
    if (selected && ids.includes(selected)) return [selected];
    return [ids[ids.length - 1]];
  }
  return ids;
}

export function parseStoredFormat(value: unknown): ContentPlanFormat {
  const raw = String(value || '').trim();
  if (raw === 'reel' || raw === 'static' || raw === 'carousel') return raw;
  return 'carousel';
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function textId(value: unknown): string {
  return String(value || '').trim();
}
