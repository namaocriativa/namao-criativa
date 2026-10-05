import { api } from "./api";
import {
  CUSTOM_VALUE,
  modelSelectHtml,
  readPickerModel,
  type LlmRole,
} from "./llm-catalog";
import { PERSONAGENS_ID } from "./creative/features";
import {
  type BrandIdentity,
  DEFAULT_LOGO_APPEARANCE,
} from "./brand-identity-modal";
import {
  defaultProduceBrandFlags,
  produceBrandPayload,
} from "./produce-brand";
import { profileApi, type EntityKind } from "./profile-api";
import type {
  CreativeCharacter,
  CreativeCharacterAsset,
  ImageModelDefinition,
  Lead,
  VideoModelDefinition,
} from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const OBJECTIVES: Array<{ id: string; label: string }> = [
  { id: "followers", label: "Aumentar seguidores" },
  { id: "leads", label: "Gerar leads e contatos" },
  { id: "sales", label: "Vender produtos ou serviços" },
  { id: "engagement", label: "Aumentar o engajamento" },
  { id: "brand", label: "Fortalecer a marca" },
  { id: "educate", label: "Educar o público" },
  { id: "launch", label: "Divulgar um lançamento" },
];

const TONES: Array<{ id: string; label: string }> = [
  { id: "professional", label: "Profissional" },
  { id: "close", label: "Próximo e humano" },
  { id: "fun", label: "Divertido" },
  { id: "sophisticated", label: "Sofisticado" },
  { id: "educational", label: "Educativo" },
  { id: "provocative", label: "Provocativo" },
];

const JOURNEY: Record<string, string> = {
  problem: "Problema",
  educate: "Educação",
  proof: "Prova social",
  convert: "Conversão",
};

type PlanItem = {
  id?: string;
  week?: number;
  scheduledAt?: string;
  title?: string;
  hook?: string;
  caption?: string;
  format?: string;
  objective?: string;
  pillar?: string;
  journeyStage?: string;
  structure?: string[];
  visualDirection?: string;
  cta?: string;
  status?: string;
  tool?: string;
  studioSource?: string;
  studioProjectId?: string;
  studioAssetIds?: string[];
  previewUrls?: string[];
  selectedStudioAssetId?: string;
  calendarPostId?: string;
  characterId?: string;
  characterAssetId?: string;
  videoHookId?: string;
  videoTakes?: Array<{
    id?: string;
    label?: string;
    beat?: string;
    productionPrompt?: string;
    studioAssetId?: string;
  }>;
};

type ProduceView = "select" | "list" | "create" | "preview";

type ProduceRun = {
  planModel: string;
  imageModel: string;
  imageSize: string;
  videoModel: string;
  duration: string;
  resolution: string;
  characterId: string;
  characterAssetId: string;
  videoHookId: string;
  useBrandIdentity: boolean;
  useBrandLogo: boolean;
  logoAppearance: string;
};

type ProduceVideoHook = {
  id: string;
  group?: string;
  title?: string;
  summary?: string;
  example?: string;
  prompt?: string;
};

type ProduceEstimate = {
  label?: string;
  stages?: Array<{
    id?: string;
    label?: string;
    detail?: string;
    model?: string;
    modelLabel?: string;
    usd?: number;
    count?: number;
    unitUsd?: number;
  }>;
};

type PlanStrategy = {
  summary?: string;
  objectives?: string[];
  audience?: { current?: string; intended?: string };
  pillars?: Array<{ name?: string; role?: string }>;
  messages?: string[];
  mix?: string;
  sequence?: string;
  goals?: Array<{ label?: string; note?: string }>;
};

type ContentPlan = {
  id: string;
  title: string;
  description?: string;
  postsPerWeek: number;
  weeks: number;
  formats?: string[];
  items: PlanItem[];
  strategy?: PlanStrategy | null;
  brief?: Record<string, unknown> | null;
  status: string;
  createdAt?: string;
};

type ClientContext = {
  username?: string | null;
  analyzedAt?: string | null;
  igJobId?: string;
  identified?: {
    postCount?: number;
    postsPerWeek?: number;
    windowDays?: number;
    mix?: { image?: number; video?: number; carousel?: number; other?: number };
    themes?: string[];
    hashtags?: string[];
    ctas?: string[];
  };
  inferred?: {
    segment?: string;
    audience?: string;
    voice?: string[];
    pillars?: string[];
    gaps?: string[];
    stage?: string;
  };
  suggestedTones?: string[];
  lead?: {
    name?: string;
    category?: string | null;
    city?: string | null;
    services?: string[];
  };
};

type OpenPayload = {
  ready?: boolean;
  reason?: "instagram_disconnected" | "ig_skill_required" | string;
  plans?: ContentPlan[];
  plan?: ContentPlan | null;
  draft?: ContentPlan | null;
  context?: ClientContext;
  previousPlan?: { id: string; title: string; createdAt?: string } | null;
  message?: string | string[];
};

function isDraftPlan(plan: ContentPlan) {
  return plan.status === "draft";
}

function formatLabel(format: string): string {
  if (format === "carousel") return "Carrossel";
  if (format === "reel") return "Reel";
  if (format === "static") return "Estático";
  return format;
}

function toolForFormat(format: string): "carousel" | "image" | "video" {
  if (format === "static") return "image";
  if (format === "reel") return "video";
  return "carousel";
}

function toolLabel(format: string): string {
  const tool = toolForFormat(format);
  if (tool === "image") return "Imagens 4:5";
  if (tool === "video") return "Vídeo livre";
  return "Carrossel Instagram";
}

function isStoragePreview(url: string): boolean {
  return url.startsWith("/storage/");
}

function previewSrcFromLocalPath(localPath: string | undefined): string {
  if (!localPath) return "";
  return `/${localPath.replace(/^\/+/, "")}`;
}

function producePreviewHtml(item: PlanItem, urls: string[]): string {
  const video = item.studioSource === "video-studio" || toolForFormat(item.format || "") === "video";
  if (!urls.length) return `<p class="lead-share-hint">Sem mídia gerada.</p>`;
  if (!video) {
    return urls
      .map(
        (url) =>
          `<img class="content-plan-preview__media" src="${escapeHtml(url)}" alt="" />`,
      )
      .join("");
  }
  const ids = item.studioAssetIds || [];
  const selected =
    item.selectedStudioAssetId && ids.includes(item.selectedStudioAssetId)
      ? item.selectedStudioAssetId
      : ids[ids.length - 1] || "";
  const selectable = item.status !== "scheduled" && ids.length > 0;
  return `<div class="content-plan-takes" role="listbox" aria-label="Takes do vídeo">
    ${urls
      .map((url, index) => {
        const id = ids[index] || "";
        const active = Boolean(id && id === selected);
        const tag = selectable
          ? `<button type="button" class="content-plan-take${active ? " is-active" : ""}" data-cp-take-id="${escapeHtml(id)}" aria-pressed="${active ? "true" : "false"}">
              <video class="content-plan-preview__media content-plan-preview__media--video" src="${escapeHtml(url)}" controls playsinline></video>
              <span>${active ? "Na agenda" : `Take ${index + 1}`}</span>
            </button>`
          : `<div class="content-plan-take${active ? " is-active" : ""}">
              <video class="content-plan-preview__media content-plan-preview__media--video" src="${escapeHtml(url)}" controls playsinline></video>
              <span>${active ? "Na agenda" : `Take ${index + 1}`}</span>
            </div>`;
        return tag;
      })
      .join("")}
  </div>`;
}

async function resolveProducePreviewUrls(item: PlanItem): Promise<string[]> {
  const urls = (item.previewUrls || []).filter(Boolean);
  if (urls.length && urls.every(isStoragePreview)) return urls;
  const projectId = item.studioProjectId;
  const ids = item.studioAssetIds || [];
  if (!projectId || !ids.length) return urls.filter(isStoragePreview);
  const video = item.studioSource === "video-studio" || toolForFormat(item.format || "") === "video";
  const path = video
    ? `/video-projects/${encodeURIComponent(projectId)}`
    : `/image-projects/${encodeURIComponent(projectId)}`;
  const res = await api(path);
  if (!res.ok) return urls.filter(isStoragePreview);
  const project = (await res.json()) as { assets?: Array<{ id?: string; localPath?: string }> };
  const byId = new Map(
    (project.assets || [])
      .filter((asset) => asset.id && asset.localPath)
      .map((asset) => [String(asset.id), previewSrcFromLocalPath(asset.localPath)]),
  );
  const resolved = ids.map((id) => byId.get(id) || "").filter(Boolean);
  if (resolved.length) item.previewUrls = resolved;
  return resolved.length ? resolved : urls.filter(isStoragePreview);
}

function itemStatusLabel(status?: string): string {
  if (status === "dropped") return "Fora";
  if (status === "created") return "Criado";
  if (status === "scheduled") return "Na agenda";
  if (status === "selected") return "Entra";
  return "Pendente";
}

function isCharacterImage(asset: CreativeCharacterAsset): boolean {
  return asset.kind !== "video" && !String(asset.mimeType || "").startsWith("video/");
}

function characterImageAssets(character: CreativeCharacter | undefined): CreativeCharacterAsset[] {
  return (character?.assets || []).filter(isCharacterImage);
}

function characterAssetById(
  character: CreativeCharacter | undefined,
  assetId: string | undefined,
): CreativeCharacterAsset | undefined {
  const id = String(assetId || "").trim();
  if (!id) return undefined;
  return characterImageAssets(character).find((asset) => asset.id === id);
}

function characterHero(character: CreativeCharacter | undefined): CreativeCharacterAsset | undefined {
  const assets = characterImageAssets(character);
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload")
  );
}

function produceCharacterPickerHtml(
  characters: CreativeCharacter[],
  selectedId: string,
  selectedAssetId = "",
): string {
  if (!characters.length) {
    return `<p class="movies-hint">Nenhum personagem na biblioteca. <a href="/criativo/habilidade/${PERSONAGENS_ID}">Criar em Personagens</a>.</p>`;
  }
  const missingHero = characters.every((item) => !characterHero(item));
  const noneActive = !selectedId;
  return `${
    missingHero
      ? `<p class="movies-hint">Gere ou envie uma foto em <a href="/criativo/habilidade/${PERSONAGENS_ID}">Personagens</a> para usar no vídeo.</p>`
      : `<p class="movies-hint">Opcional. Clique no personagem para escolher a foto usada como quadro inicial.</p>`
  }<div class="movies-cast" role="listbox" aria-label="Personagem">
      <button type="button" class="movies-cast-option${noneActive ? " is-active" : ""}" data-character-id="" aria-pressed="${noneActive ? "true" : "false"}">
        <span class="movies-cast-empty"></span>
        <span>Nenhum</span>
      </button>
      ${characters
        .map((item) => {
          const chosen =
            characterAssetById(item, selectedId === item.id ? selectedAssetId : "") ||
            characterHero(item);
          const src = previewSrcFromLocalPath(chosen?.localPath);
          const selected = item.id === selectedId;
          const disabled = !characterHero(item);
          return `<button type="button" class="movies-cast-option${selected ? " is-active" : ""}" data-character-id="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""} aria-pressed="${selected ? "true" : "false"}" title="${disabled ? "Gere uma foto em Personagens" : `Escolher foto de ${escapeHtml(item.name)}`}">
            ${
              src
                ? `<img src="${escapeHtml(src)}" alt="" />`
                : `<span class="movies-cast-empty"></span>`
            }
            <span>${escapeHtml(item.name)}</span>
          </button>`;
        })
        .join("")}
    </div>`;
}

function isDroppedItem(item: PlanItem) {
  return item.status === "dropped";
}

function activeProduceItems(plan: ContentPlan) {
  return (plan.items || []).filter((item) => !isDroppedItem(item));
}

function defaultProduceRun(): ProduceRun {
  return {
    planModel: "gemini-2.5-flash",
    imageModel: "gemini-3-pro-image",
    imageSize: "2K",
    videoModel: "gemini-omni-1.1-flash",
    duration: "8s",
    resolution: "360p",
    characterId: "",
    characterAssetId: "",
    videoHookId: "",
    useBrandIdentity: false,
    useBrandLogo: false,
    logoAppearance: "",
  };
}

function resumeProduceView(plan: ContentPlan): ProduceView {
  const items = plan.items || [];
  const hasProgress = items.some(
    (item) =>
      item.status === "dropped" ||
      item.status === "created" ||
      item.status === "scheduled",
  );
  return hasProgress ? "list" : "select";
}

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDay(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function nextMondayValue(from = new Date()): string {
  const date = new Date(from);
  const mondayIndex = (date.getDay() + 6) % 7;
  const delta = mondayIndex === 0 ? 7 : 7 - mondayIndex;
  date.setDate(date.getDate() + delta);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function mixLabel(mix?: ClientContext["identified"]): string {
  if (!mix?.mix) return "—";
  const parts = [
    mix.mix.image ? `${mix.mix.image} fotos` : "",
    mix.mix.video ? `${mix.mix.video} vídeos` : "",
    mix.mix.carousel ? `${mix.mix.carousel} carrosséis` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

function readError(payload: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(payload.message)) return payload.message.join(", ");
  return payload.message || fallback;
}

function fact(label: string, value: string, source: "identified" | "inferred") {
  const tag = source === "identified" ? "Identificado" : "Inferido";
  return `<div class="content-plan-fact">
    <p class="content-plan-fact__label">${escapeHtml(label)} <span class="content-plan-tag content-plan-tag--${source}">${tag}</span></p>
    <p class="content-plan-fact__value">${escapeHtml(value || "—")}</p>
  </div>`;
}

export function initContentPlanModal(
  host: HTMLElement,
  opts?: { onOpenReport?: () => void },
): {
  open: (leadId: string, kind?: EntityKind, current?: Lead | null) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let kind: EntityKind = "lead";
  let busy = false;
  let draft: ContentPlan | null = null;
  let savedPlans: ContentPlan[] = [];
  let clientContext: ClientContext | null = null;
  let previousPlan: OpenPayload["previousPlan"] = null;
  let formStep = 0;
  let produceView: ProduceView = "select";
  let produceItemId: string | null = null;
  let produceRun: ProduceRun = defaultProduceRun();
  let produceEstimateMode: "create" | "regen" = "create";
  let produceBreakTakeCount = 3;
  let produceBrand: BrandIdentity | null = null;
  let produceCharacters: CreativeCharacter[] | null = null;
  let produceVideoHooks: ProduceVideoHook[] | null = null;
  let imageCatalog: { defaultModelId?: string; models: ImageModelDefinition[] } | null = null;
  let videoCatalog: { defaultModelId?: string; models: VideoModelDefinition[] } | null = null;
  let llmLive: string[] = [];
  const PRODUCE_STEPS = [
    { id: "select", label: "Peças" },
    { id: "list", label: "Produzir" },
    { id: "preview", label: "Agenda" },
  ] as const;
  const FORM_STEPS = [
    { id: "profile", label: "Perfil" },
    { id: "goals", label: "Objetivos" },
    { id: "voice", label: "Comunicação" },
    { id: "calendar", label: "Calendário" },
  ] as const;

  host.innerHTML = `
    <div class="site-wizard-modal content-plan-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-cp-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="content-plan-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Planejamento</p>
            <h3 id="content-plan-title">Skill planejamento</h3>
          </div>
          <button type="button" class="outline" data-cp-close>Fechar</button>
        </header>
        <div data-cp-body class="content-plan-body"></div>
        <p class="status" data-cp-status></p>
      </div>
      <div class="videos-picker content-plan-hooks-modal" data-cp-hooks-modal hidden>
        <div class="videos-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="content-plan-hooks-title">
          <header>
            <h3 id="content-plan-hooks-title">Hooks visuais</h3>
            <button type="button" data-cp-hooks-close>Fechar</button>
          </header>
          <p class="movies-hint">Estilo de câmera e mundo — não uma cena pronta. A cadeira no céu é o viral de referência; o vídeo usa o assunto da peça (e o personagem, se houver).</p>
          <div data-cp-hooks-list></div>
        </div>
      </div>
      <div class="videos-picker content-plan-character-modal" data-cp-character-modal hidden>
        <div class="videos-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="content-plan-character-title">
          <header>
            <h3 id="content-plan-character-title">Escolha a foto do personagem</h3>
            <button type="button" data-cp-character-close>Fechar</button>
          </header>
          <p class="movies-hint" data-cp-character-status></p>
          <div class="videos-picker-grid" data-cp-character-grid></div>
          <p class="movies-toolbar">
            <button type="button" class="outline danger" data-cp-character-remove hidden>Remover personagem</button>
          </p>
        </div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".content-plan-modal")!;
  const body = host.querySelector<HTMLElement>("[data-cp-body]")!;
  const status = host.querySelector<HTMLElement>("[data-cp-status]")!;

  function setStatus(message: string) {
    status.textContent = message;
  }

  function ownerQuery() {
    const key = kind === "customer" ? "customerId" : "leadId";
    return `${key}=${encodeURIComponent(leadId || "")}`;
  }

  function ownerBody() {
    return kind === "customer" ? { customerId: leadId } : { leadId };
  }

  function close() {
    modal.hidden = true;
    modal.classList.remove("content-plan-modal--result");
    busy = false;
    draft = null;
    savedPlans = [];
    clientContext = null;
    previousPlan = null;
    formStep = 0;
    produceView = "select";
    produceItemId = null;
    produceRun = defaultProduceRun();
    produceCharacters = null;
    produceVideoHooks = null;
    closeProduceHooks();
    closeProduceCharacterPicker();
    status.textContent = "";
  }

  function setHeading(label: string) {
    const title = document.getElementById("content-plan-title");
    if (title) title.textContent = label;
  }

  function paintGate(reason?: string) {
    modal.classList.remove("content-plan-modal--result");
    setHeading("Skill planejamento");
    const needConn = reason === "instagram_disconnected";
    body.innerHTML = `
      <p class="lead-share-hint">O plano começa pelo diagnóstico da Skill Instagram. Conclua as etapas abaixo.</p>
      <ol class="content-plan-steps">
        <li class="${needConn ? "is-todo" : "is-done"}">${needConn ? "Conecte o Instagram deste perfil." : "Instagram conectado."}</li>
        <li class="is-todo">${needConn ? "Depois rode a Skill Instagram e espere o relatório." : "Rode a Skill Instagram e espere o relatório."}</li>
      </ol>
    `;
  }

  function paintList() {
    modal.classList.remove("content-plan-modal--result");
    setHeading("Skill planejamento");
    if (!savedPlans.length) {
      paintForm();
      return;
    }
    const cards = savedPlans
      .map((plan) => {
        const pending = isDraftPlan(plan);
        return `
        <li>
          <button type="button" data-cp-open="${escapeHtml(plan.id)}">
            <strong>${escapeHtml(plan.title)}</strong>
            <span>${escapeHtml(plan.postsPerWeek)} posts/semana · ${escapeHtml(plan.weeks)} semanas · ${escapeHtml((plan.items || []).length)} peças</span>
            <span class="content-plan-tag ${pending ? "content-plan-tag--inferred" : "content-plan-tag--identified"}">${pending ? "Rascunho" : "Confirmado"}</span>
            <span class="cal-idea-kicker">${escapeHtml(formatWhen(plan.createdAt))}</span>
          </button>
        </li>`;
      })
      .join("");
    body.innerHTML = `
      <p class="lead-share-hint">Planos deste perfil. O rascunho ainda pode ser confirmado ou descartado.</p>
      <ul class="cal-create-list">${cards}</ul>
      <div class="actions content-plan-nav">
        <button type="button" data-cp-new>Novo plano</button>
      </div>
    `;
  }

  function bindForm() {
    const form = host.querySelector<HTMLFormElement>("[data-cp-form]");
    if (!form) return;
    const objectiveBoxes = [
      ...form.querySelectorAll<HTMLInputElement>('input[name="objective"]'),
    ];
    function enforceObjectives() {
      const checked = objectiveBoxes.filter((input) => input.checked);
      objectiveBoxes.forEach((input) => {
        input.disabled = !input.checked && checked.length >= 3;
      });
    }
    objectiveBoxes.forEach((input) =>
      input.addEventListener("change", enforceObjectives),
    );
    enforceObjectives();
    const posts = form.querySelector<HTMLInputElement>('[name="postsPerWeek"]');
    const weeks = form.querySelector<HTMLInputElement>('[name="weeks"]');
    const total = form.querySelector<HTMLElement>("[data-cp-total]");
    function paintTotal() {
      if (!total || !posts || !weeks) return;
      const n = Math.max(1, Number(posts.value) || 3) * Math.max(2, Number(weeks.value) || 4);
      total.textContent = `${n} publicações`;
    }
    posts?.addEventListener("input", paintTotal);
    weeks?.addEventListener("input", paintTotal);
    paintTotal();
    showFormStep(formStep);
  }

  function showFormStep(index: number) {
    const form = host.querySelector<HTMLFormElement>("[data-cp-form]");
    if (!form) return;
    formStep = Math.max(0, Math.min(FORM_STEPS.length - 1, index));
    form.querySelectorAll<HTMLElement>("[data-cp-step]").forEach((section) => {
      const step = Number(section.getAttribute("data-cp-step"));
      const active = step === formStep;
      section.classList.toggle("is-active", active);
      section.removeAttribute("hidden");
    });
    form.querySelectorAll<HTMLElement>("[data-cp-progress-item]").forEach((item) => {
      const step = Number(item.getAttribute("data-cp-progress-item"));
      item.classList.toggle("is-current", step === formStep);
      item.classList.toggle("is-done", step < formStep);
    });
    const back = form.querySelector<HTMLButtonElement>("[data-cp-back]");
    const next = form.querySelector<HTMLButtonElement>("[data-cp-next]");
    const submit = form.querySelector<HTMLButtonElement>("[data-cp-generate]");
    if (back) back.hidden = formStep === 0;
    if (next) next.hidden = formStep >= FORM_STEPS.length - 1;
    if (submit) submit.hidden = formStep < FORM_STEPS.length - 1;
    setHeading(FORM_STEPS[formStep].label);
  }

  function validateFormStep(): boolean {
    const form = host.querySelector<HTMLFormElement>("[data-cp-form]");
    if (!form) return false;
    if (formStep === 1) {
      const objectives = [
        ...form.querySelectorAll<HTMLInputElement>('input[name="objective"]:checked'),
      ];
      if (!objectives.length) {
        setStatus("Escolha até três objetivos.");
        return false;
      }
    }
    if (formStep === 3) {
      const formats = [
        ...form.querySelectorAll<HTMLInputElement>('input[name="format"]:checked'),
      ];
      if (!formats.length) {
        setStatus("Escolha ao menos um tipo de post.");
        return false;
      }
      const startsOn = form.querySelector<HTMLInputElement>('[name="startsOn"]');
      if (startsOn && !startsOn.value) {
        setStatus("Informe a data de início.");
        return false;
      }
    }
    setStatus("");
    return true;
  }

  function goFormNext() {
    if (!validateFormStep()) return;
    showFormStep(formStep + 1);
  }

  function goFormBack() {
    setStatus("");
    showFormStep(formStep - 1);
  }

  function paintForm() {
    modal.classList.remove("content-plan-modal--result");
    formStep = 0;
    const ctx = clientContext;
    const identified = ctx?.identified;
    const inferred = ctx?.inferred;
    const handle = ctx?.username ? `@${ctx.username.replace(/^@/, "")}` : ctx?.lead?.name || "perfil";
    const tones = new Set(ctx?.suggestedTones || ["professional", "close"]);
    const previous = previousPlan
      ? `<label class="content-plan-check">
          <input type="checkbox" name="usePreviousPlan" />
          Usar “${escapeHtml(previousPlan.title)}” como referência
        </label>`
      : "";
    body.innerHTML = `
      <form class="content-plan-form" data-cp-form>
        <ol class="content-plan-progress" aria-label="Etapas do planejamento">
          ${FORM_STEPS.map(
            (step, index) => `
            <li data-cp-progress-item="${index}">
              <span class="content-plan-progress__index">${index + 1}</span>
              <span class="content-plan-progress__label">${escapeHtml(step.label)}</span>
            </li>`,
          ).join("")}
        </ol>
        <div class="content-plan-stage">
        <section class="content-plan-block is-active" data-cp-step="0">
          <header class="content-plan-stephead">
            <p class="content-plan-kicker">Etapa 1</p>
            <h4>Seu perfil hoje</h4>
            <p class="content-plan-lede">O plano parte deste diagnóstico. Corrija o que a IA inferiu antes de seguir.</p>
          </header>
          <div class="content-plan-profile">
            <div>
              <strong>${escapeHtml(handle)}</strong>
              <p class="meta">Análise disponível${ctx?.analyzedAt ? ` · ${escapeHtml(formatDay(ctx.analyzedAt))}` : ""}</p>
            </div>
            <button type="button" class="secondary" data-cp-review>Revisar relatório</button>
          </div>
          <div class="content-plan-facts">
            ${fact("Segmento", inferred?.segment || ctx?.lead?.category || "", "inferred")}
            ${fact("Público", inferred?.audience || "", "inferred")}
            ${fact("Comunicação", (inferred?.voice || []).join(", "), "inferred")}
            ${fact("Conteúdo", mixLabel(identified), "identified")}
            ${fact("Temas", (identified?.themes || []).join(", "), "identified")}
          </div>
          <div class="content-plan-row">
            <label>Segmento
              <input name="segment" maxlength="200" value="${escapeHtml(inferred?.segment || "")}" />
            </label>
            <label>Público
              <input name="audience" maxlength="200" value="${escapeHtml(inferred?.audience || "")}" />
            </label>
          </div>
          <label>Tom identificado
            <input name="voice" maxlength="200" value="${escapeHtml((inferred?.voice || []).join(", "))}" />
          </label>
        </section>

        <section class="content-plan-block" data-cp-step="1">
          <header class="content-plan-stephead">
            <p class="content-plan-kicker">Etapa 2</p>
            <h4>Aonde você quer chegar?</h4>
            <p class="content-plan-lede">Escolha até três objetivos. Eles definem a estratégia e a ordem das peças.</p>
          </header>
          <fieldset class="content-plan-chips">
            <legend class="visually-hidden">Objetivos</legend>
            ${OBJECTIVES.map(
              (item, index) => `
              <label class="content-plan-chip">
                <input type="checkbox" name="objective" value="${item.id}" ${index === 1 || index === 4 ? "checked" : ""} />
                ${escapeHtml(item.label)}
              </label>`,
            ).join("")}
          </fieldset>
          <label>Alguma meta específica?
            <textarea name="goalNote" rows="2" maxlength="400" placeholder="Ex.: receber mensagens qualificadas no Direct. Sem números inventados."></textarea>
          </label>
        </section>

        <section class="content-plan-block" data-cp-step="2">
          <header class="content-plan-stephead">
            <p class="content-plan-kicker">Etapa 3</p>
            <h4>Como a marca deve falar?</h4>
            <p class="content-plan-lede">Tom, o que promover e o que evitar. Isso entra no briefing de cada peça.</p>
          </header>
          <fieldset class="content-plan-chips">
            <legend class="visually-hidden">Tom de comunicação</legend>
            ${TONES.map(
              (item) => `
              <label class="content-plan-chip">
                <input type="checkbox" name="tone" value="${item.id}" ${tones.has(item.id) ? "checked" : ""} />
                ${escapeHtml(item.label)}
              </label>`,
            ).join("")}
          </fieldset>
          <label>O que você deseja promover?
            <textarea name="promote" rows="2" maxlength="2000" placeholder="Oferta, lançamento, prova que importa."></textarea>
          </label>
          <label>O que devemos evitar?
            <textarea name="avoid" rows="2" maxlength="2000" placeholder="Tom, temas, clichês."></textarea>
          </label>
        </section>

        <section class="content-plan-block" data-cp-step="3">
          <header class="content-plan-stephead">
            <p class="content-plan-kicker">Etapa 4</p>
            <h4>Cadência e formatos</h4>
            <p class="content-plan-lede">Defina o ritmo. A IA monta a sequência dentro desses limites.</p>
          </header>
          <div class="content-plan-row">
            <label>Posts por semana
              <input name="postsPerWeek" type="number" min="1" max="7" value="3" />
            </label>
            <label>Duração (semanas)
              <input name="weeks" type="number" min="2" max="8" value="4" />
            </label>
          </div>
          <label>Data de início
            <input name="startsOn" type="date" value="${escapeHtml(nextMondayValue())}" />
          </label>
          <fieldset class="content-plan-chips">
            <legend class="content-plan-legend">Formatos</legend>
            <label class="content-plan-chip"><input type="checkbox" name="format" value="carousel" checked /> Carrossel</label>
            <label class="content-plan-chip"><input type="checkbox" name="format" value="reel" checked /> Reels</label>
            <label class="content-plan-chip"><input type="checkbox" name="format" value="static" /> Estático</label>
          </fieldset>
          <fieldset class="content-plan-chips">
            <legend class="content-plan-legend">Distribuição</legend>
            <label class="content-plan-chip"><input type="radio" name="formatMix" value="ai" checked /> A IA decide</label>
            <label class="content-plan-chip"><input type="radio" name="formatMix" value="balanced" /> Equilibrada</label>
          </fieldset>
          <p class="content-plan-total">Total planejado <strong data-cp-total>12 publicações</strong></p>
          ${previous}
        </section>
        </div>

        <div class="actions content-plan-nav">
          <button type="button" class="secondary" data-cp-back hidden>Voltar</button>
          <button type="button" data-cp-next>Continuar</button>
          <button type="submit" data-cp-generate hidden>Gerar plano</button>
        </div>
      </form>
    `;
    bindForm();
  }

  function paintStrategy(strategy?: PlanStrategy | null) {
    if (!strategy) return "";
    const pillars = (strategy.pillars || [])
      .filter((item) => item.name)
      .map(
        (item) => `<article class="content-plan-pillar">
          <strong>${escapeHtml(item.name)}</strong>
          ${item.role ? `<span>${escapeHtml(item.role)}</span>` : ""}
        </article>`,
      )
      .join("");
    const goals = (strategy.goals || [])
      .filter((item) => item.label)
      .map(
        (item) => `<article class="content-plan-pillar">
          <strong>${escapeHtml(item.label)}</strong>
          ${item.note ? `<span>${escapeHtml(item.note)}</span>` : ""}
        </article>`,
      )
      .join("");
    const facts = [
      strategy.audience?.current
        ? fact("Público atual", strategy.audience.current, "identified")
        : "",
      strategy.audience?.intended
        ? fact("Público pretendido", strategy.audience.intended, "inferred")
        : "",
      strategy.mix ? fact("Mix", strategy.mix, "inferred") : "",
    ]
      .filter(Boolean)
      .join("");
    return `
      <section class="content-plan-strategy">
        <header class="content-plan-stephead">
          <p class="content-plan-kicker">Estratégia</p>
          <h4>Direção do plano</h4>
          ${
            strategy.summary
              ? `<p class="content-plan-lede">${escapeHtml(strategy.summary)}</p>`
              : ""
          }
        </header>
        ${facts ? `<div class="content-plan-facts">${facts}</div>` : ""}
        ${
          strategy.sequence
            ? `<p class="content-plan-sequence">${escapeHtml(strategy.sequence)}</p>`
            : ""
        }
        ${pillars ? `<div class="content-plan-pillars">${pillars}</div>` : ""}
        ${goals ? `<p class="content-plan-legend">Indicadores</p><div class="content-plan-pillars">${goals}</div>` : ""}
      </section>
    `;
  }

  function paintItem(item: PlanItem) {
    const steps = (item.structure || [])
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join("");
    const extra = [
      steps ? `<ol class="content-plan-structure">${steps}</ol>` : "",
      item.visualDirection
        ? `<p class="meta">${escapeHtml(item.visualDirection)}</p>`
        : "",
      item.cta ? `<p class="content-plan-cta">${escapeHtml(item.cta)}</p>` : "",
      item.caption ? `<p class="meta">${escapeHtml(item.caption)}</p>` : "",
    ]
      .filter(Boolean)
      .join("");
    return `
      <article class="content-plan-item">
        <p class="cal-idea-kicker">${escapeHtml(formatWhen(item.scheduledAt))} · ${escapeHtml(formatLabel(item.format || ""))}</p>
        <strong>${escapeHtml(item.title || "")}</strong>
        ${item.hook ? `<p>${escapeHtml(item.hook)}</p>` : ""}
        <p class="meta">${escapeHtml(item.objective || "")}${item.pillar ? ` · ${escapeHtml(item.pillar)}` : ""}${JOURNEY[item.journeyStage || ""] ? ` · ${escapeHtml(JOURNEY[item.journeyStage || ""])}` : ""}</p>
        ${
          extra
            ? `<details class="content-plan-item__more">
                <summary>Briefing da peça</summary>
                ${extra}
              </details>`
            : ""
        }
      </article>`;
  }

  function paintPlan(plan: ContentPlan, mode: "preview" | "saved") {
    modal.classList.add("content-plan-modal--result");
    setHeading(plan.title || "Plano");
    const grouped = new Map<number, PlanItem[]>();
    for (const item of plan.items || []) {
      const week = Number(item.week) || 1;
      const list = grouped.get(week) || [];
      list.push(item);
      grouped.set(week, list);
    }
    const weeks = [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([week, list]) => `
        <section class="content-plan-week">
          <p class="content-plan-kicker">Semana ${escapeHtml(week)}</p>
          ${list.map((item) => paintItem(item)).join("")}
        </section>`,
      )
      .join("");
    body.innerHTML = `
      <div class="content-plan-result">
        <div class="content-plan-result__scroll">
          <p class="content-plan-result__meta">${escapeHtml(plan.postsPerWeek)} posts/semana · ${escapeHtml(plan.weeks)} semanas · ${escapeHtml((plan.items || []).length)} peças</p>
          ${paintStrategy(plan.strategy)}
          ${weeks}
        </div>
        <div class="actions content-plan-nav">
          ${
            mode === "preview"
              ? `<button type="button" class="secondary" data-cp-discard>Descartar</button>
                 <button type="button" data-cp-confirm>Confirmar</button>`
              : `<button type="button" class="secondary" data-cp-list>Planos</button>
                 <button type="button" data-cp-new>Novo plano</button>`
          }
        </div>
      </div>
    `;
  }

  function produceProgressIndex(view: ProduceView) {
    if (view === "select") return 0;
    if (view === "preview") return 2;
    return 1;
  }

  function paintProduceProgress(view: ProduceView) {
    const current = produceProgressIndex(view);
    return `<ol class="content-plan-progress content-plan-progress--produce" aria-label="Etapas da produção">
      ${PRODUCE_STEPS.map(
        (step, index) => `
        <li class="${index === current ? "is-current" : index < current ? "is-done" : ""}" data-cp-produce-progress="${escapeHtml(step.id)}">
          <span class="content-plan-progress__index">${index + 1}</span>
          <span class="content-plan-progress__label">${escapeHtml(step.label)}</span>
        </li>`,
      ).join("")}
    </ol>`;
  }

  function rememberPlan(plan: ContentPlan) {
    draft = plan;
    savedPlans = savedPlans.some((item) => item.id === plan.id)
      ? savedPlans.map((item) => (item.id === plan.id ? plan : item))
      : [plan, ...savedPlans];
  }

  function findProduceItem(plan: ContentPlan, itemId?: string | null) {
    if (!itemId) return null;
    return (plan.items || []).find((item) => item.id === itemId) || null;
  }

  function openProduce(plan: ContentPlan, view?: ProduceView, itemId?: string | null) {
    rememberPlan(plan);
    produceItemId = itemId || null;
    produceView = view || resumeProduceView(plan);
    const item = findProduceItem(plan, produceItemId);
    if (produceView === "create" || produceView === "preview") {
      if (!item || isDroppedItem(item)) {
        produceView = "list";
        produceItemId = null;
      } else if (item.status === "created" || item.status === "scheduled") {
        produceView = "preview";
      } else {
        produceView = "create";
      }
    }
    paintProduce();
  }

  function paintProduce() {
    if (!draft) return;
    modal.classList.add("content-plan-modal--result");
    if (produceView !== "create") {
      modal.classList.remove("content-plan-modal--settings");
    }
    if (produceView === "select") {
      paintProduceSelect(draft);
      return;
    }
    if (produceView === "list") {
      paintProduceList(draft);
      return;
    }
    const item = findProduceItem(draft, produceItemId);
    if (!item || isDroppedItem(item)) {
      produceView = "list";
      produceItemId = null;
      paintProduceList(draft);
      return;
    }
    void ensureProduceBrand().then(() => {
      if (!draft) return;
      const current = findProduceItem(draft, produceItemId);
      if (!current || isDroppedItem(current)) return;
      if (
        produceView === "preview" ||
        current.status === "created" ||
        current.status === "scheduled"
      ) {
        paintProducePreview(draft, current);
        return;
      }
      paintProduceCreate(draft, current);
    });
  }

  function paintProduceSelect(plan: ContentPlan) {
    setHeading("Escolher peças");
    const cards = (plan.items || [])
      .map((item) => {
        const checked = item.status !== "dropped";
        const locked = item.status === "created" || item.status === "scheduled";
        return `
        <label class="content-plan-pick${checked ? "" : " is-off"}">
          <input type="checkbox" name="keep" value="${escapeHtml(item.id || "")}" ${checked ? "checked" : ""} ${locked ? "disabled" : ""} />
          <span>
            <p class="cal-idea-kicker">${escapeHtml(formatWhen(item.scheduledAt))} · ${escapeHtml(formatLabel(item.format || ""))} · ${escapeHtml(toolLabel(item.format || ""))}</p>
            <strong>${escapeHtml(item.title || "")}</strong>
            ${item.hook ? `<p>${escapeHtml(item.hook)}</p>` : ""}
            <p class="meta">${escapeHtml(itemStatusLabel(item.status))}</p>
          </span>
        </label>`;
      })
      .join("");
    body.innerHTML = `
      <div class="content-plan-result">
        ${paintProduceProgress("select")}
        <div class="content-plan-result__scroll">
          <p class="content-plan-lede">Marque as peças que entram. As desmarcadas saem da produção.</p>
          <div class="content-plan-picks">${cards || `<p class="lead-share-hint">Este plano não tem peças.</p>`}</div>
        </div>
        <div class="actions content-plan-nav">
          <button type="button" class="secondary" data-cp-list>Planos</button>
          <button type="button" data-cp-produce-next>Continuar</button>
        </div>
      </div>
    `;
  }

  function paintProduceList(plan: ContentPlan) {
    setHeading("Produzir peças");
    const items = activeProduceItems(plan);
    const cards = items
      .map((item) => {
        const done = item.status === "scheduled";
        const created = item.status === "created";
        return `
        <li>
          <button type="button" data-cp-produce-item="${escapeHtml(item.id || "")}">
            <p class="cal-idea-kicker">${escapeHtml(formatWhen(item.scheduledAt))} · ${escapeHtml(toolLabel(item.format || ""))}</p>
            <strong>${escapeHtml(item.title || "")}</strong>
            ${item.hook ? `<span>${escapeHtml(item.hook)}</span>` : ""}
            <span class="content-plan-tag ${done ? "content-plan-tag--identified" : created ? "content-plan-tag--inferred" : ""}">${escapeHtml(itemStatusLabel(item.status))}</span>
          </button>
        </li>`;
      })
      .join("");
    body.innerHTML = `
      <div class="content-plan-result">
        ${paintProduceProgress("list")}
        <div class="content-plan-result__scroll">
          <p class="content-plan-lede">Abra uma peça para gerar o conteúdo na ferramenta indicada.</p>
          <ul class="cal-create-list">${cards || `<li><p class="lead-share-hint">Nenhuma peça selecionada.</p></li>`}</ul>
        </div>
        <div class="actions content-plan-nav">
          <button type="button" class="secondary" data-cp-produce-back>Voltar</button>
          <button type="button" class="secondary" data-cp-list>Planos</button>
        </div>
      </div>
    `;
  }

  function currentImageModel() {
    return imageCatalog?.models.find((model) => model.id === produceRun.imageModel) || imageCatalog?.models[0];
  }

  function currentVideoModel() {
    return videoCatalog?.models.find((model) => model.id === produceRun.videoModel) || videoCatalog?.models[0];
  }

  function fillSelect(select: HTMLSelectElement, values: string[], current: string) {
    const selected = values.includes(current) ? current : values[0] || current;
    select.innerHTML = values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("");
    select.value = selected;
    return selected;
  }

  function produceRunPayload(item: PlanItem, takeId?: string) {
    const tool = toolForFormat(item.format || "");
    const nextTake =
      takeId ||
      (item.videoTakes || []).find((take) => take.id && !take.studioAssetId)?.id ||
      "";
    return {
      planModel: produceRun.planModel,
      imageModel: produceRun.imageModel,
      imageSize: produceRun.imageSize,
      videoModel: produceRun.videoModel,
      duration: produceRun.duration,
      resolution: produceRun.resolution,
      slides: (item.structure || []).length || undefined,
      ...(tool === "video" && produceRun.characterId
        ? {
            characterId: produceRun.characterId,
            ...(produceRun.characterAssetId
              ? { characterAssetId: produceRun.characterAssetId }
              : {}),
          }
        : {}),
      ...(tool === "video" ? { videoHookId: produceRun.videoHookId || "" } : {}),
      ...(tool === "video" && nextTake ? { takeId: nextTake } : {}),
      ...produceBrandPayload({
        useBrandIdentity: produceRun.useBrandIdentity,
        useBrandLogo: produceRun.useBrandLogo,
        logoAppearance: produceRun.logoAppearance,
      }),
    };
  }

  function produceEstimateLabel(data?: ProduceEstimate | null) {
    if (data && data.label === "") return "";
    if (!data?.label) {
      return produceEstimateMode === "regen" ? "Estimando custo para regerar…" : "Estimando custo…";
    }
    if (produceEstimateMode === "regen") {
      return data.label.replace(/^Estimativa\b/, "Custo para regerar");
    }
    return data.label;
  }

  function paintProduceEstimate(data?: ProduceEstimate | null) {
    const box = body.querySelector<HTMLElement>("[data-cp-estimate]");
    if (!box) return;
    const stages = (data?.stages || [])
      .map((stage) => {
        const usd = Number(stage.usd);
        const cost = Number.isFinite(usd) ? `~US$ ${usd.toFixed(2)}` : "";
        return `<li>
          <span>
            ${escapeHtml(stage.label || "")}
            <em>${escapeHtml(stage.modelLabel || stage.model || "")}</em>
            ${stage.detail ? `<small>${escapeHtml(stage.detail)}</small>` : ""}
          </span>
          ${cost ? `<strong>${escapeHtml(cost)}</strong>` : ""}
        </li>`;
      })
      .join("");
    box.innerHTML = `
      ${stages ? `<ol class="content-plan-ai">${stages}</ol>` : ""}
      <p class="content-plan-cost">${escapeHtml(produceEstimateLabel(data))}</p>
    `;
  }

  async function refreshProduceEstimate(item: PlanItem) {
    paintProduceEstimate({ label: produceEstimateLabel() });
    try {
      const params = new URLSearchParams();
      const payload = produceRunPayload(item);
      const tool = toolForFormat(item.format || "");
      params.set(
        "format",
        item.format || (tool === "video" ? "reel" : tool === "image" ? "static" : "carousel"),
      );
      Object.entries(payload).forEach(([key, value]) => {
        if (value != null && String(value).trim()) params.set(key, String(value));
      });
      const pendingTakes = (item.videoTakes || []).filter((take) => !take.studioAssetId).length;
      const plannedTakes = (item.videoTakes || []).length;
      if (tool === "video" && plannedTakes > 1) {
        params.set(
          "takes",
          String(produceEstimateMode === "regen" ? 1 : Math.max(1, pendingTakes || plannedTakes)),
        );
      }
      const res = await api(`/content-plan/estimate?${params.toString()}`);
      if (!res.ok) return;
      paintProduceEstimate((await res.json()) as ProduceEstimate);
    } catch {
      paintProduceEstimate({ label: "" });
    }
  }

  async function ensureProduceCatalogs() {
    if (!imageCatalog) {
      try {
        const res = await api("/image-models");
        if (res.ok) {
          imageCatalog = (await res.json()) as { defaultModelId?: string; models: ImageModelDefinition[] };
          if (!produceRun.imageModel && imageCatalog.defaultModelId) {
            produceRun.imageModel = imageCatalog.defaultModelId;
          }
        }
      } catch {
        imageCatalog = { models: [] };
      }
    }
    if (!videoCatalog) {
      try {
        const res = await api("/video-models");
        if (res.ok) {
          videoCatalog = (await res.json()) as { defaultModelId?: string; models: VideoModelDefinition[] };
          if (!produceRun.videoModel && videoCatalog.defaultModelId) {
            produceRun.videoModel = videoCatalog.defaultModelId;
          }
        }
      } catch {
        videoCatalog = { models: [] };
      }
    }
    try {
      const res = await api("/config/llm");
      if (res.ok) {
        const data = (await res.json()) as {
          gemini?: { models?: string[] };
          settings?: { roles?: { plan?: { model?: string } } };
          defaults?: { gemini?: { plan?: string } };
        };
        llmLive = data.gemini?.models || [];
        const plan =
          data.settings?.roles?.plan?.model || data.defaults?.gemini?.plan || produceRun.planModel;
        if (plan) produceRun.planModel = plan;
      }
    } catch {
      llmLive = [];
    }
    await ensureProduceBrand();
  }

  let produceBrandDefaultsApplied = false;

  async function ensureProduceBrand() {
    if (!leadId) return;
    if (produceBrand == null) {
      try {
        const res = await api(profileApi(kind, leadId, "/brand-identity"));
        produceBrand = res.ok ? ((await res.json()) as BrandIdentity) : {};
      } catch {
        produceBrand = {};
      }
    }
    if (!produceBrandDefaultsApplied) {
      const flags = defaultProduceBrandFlags(produceBrand);
      produceRun.useBrandIdentity = flags.useBrandIdentity;
      produceRun.useBrandLogo = false;
      produceRun.logoAppearance = DEFAULT_LOGO_APPEARANCE;
      produceBrandDefaultsApplied = true;
    }
  }

  function applyProduceSettings(item: PlanItem) {
    const tool = toolForFormat(item.format || "");
    const imageSelect = body.querySelector<HTMLSelectElement>("[data-cp-image-model]");
    const sizeSelect = body.querySelector<HTMLSelectElement>("[data-cp-image-size]");
    const videoSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-model]");
    const durationSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-duration]");
    const resolutionSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-resolution]");
    const planSelect = body.querySelector<HTMLSelectElement>("[data-cp-plan-model]");
    const planCustom = body.querySelector<HTMLInputElement>("[data-cp-plan-custom]");
    const planWrap = body.querySelector<HTMLElement>("[data-cp-plan-custom-wrap]");
    if (imageSelect && imageCatalog?.models.length) {
      imageSelect.innerHTML = imageCatalog.models
        .map(
          (model) =>
            `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`,
        )
        .join("");
      imageSelect.value = imageCatalog.models.some((model) => model.id === produceRun.imageModel)
        ? produceRun.imageModel
        : imageCatalog.defaultModelId || imageCatalog.models[0].id;
      produceRun.imageModel = imageSelect.value;
    }
    const imageModel = currentImageModel();
    if (sizeSelect && imageModel) {
      produceRun.imageSize = fillSelect(
        sizeSelect,
        imageModel.capabilities.resolutions || ["2K"],
        produceRun.imageSize,
      );
    }
    if (videoSelect && videoCatalog?.models.length) {
      videoSelect.innerHTML = videoCatalog.models
        .map(
          (model) =>
            `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`,
        )
        .join("");
      videoSelect.value = videoCatalog.models.some((model) => model.id === produceRun.videoModel)
        ? produceRun.videoModel
        : videoCatalog.defaultModelId || videoCatalog.models[0].id;
      produceRun.videoModel = videoSelect.value;
    }
    const videoModel = currentVideoModel();
    if (durationSelect && videoModel) {
      produceRun.duration = fillSelect(
        durationSelect,
        videoModel.capabilities.durations || ["8s"],
        produceRun.duration,
      );
    }
    if (resolutionSelect && videoModel) {
      produceRun.resolution = fillSelect(
        resolutionSelect,
        videoModel.capabilities.resolutions || ["360p"],
        produceRun.resolution,
      );
    }
    if (planSelect) {
      const picker = modelSelectHtml("plan" as LlmRole, llmLive, produceRun.planModel);
      planSelect.innerHTML = picker.html;
      planSelect.value = picker.value;
      if (planCustom) planCustom.value = picker.custom;
      if (planWrap) planWrap.hidden = picker.value !== CUSTOM_VALUE;
      produceRun.planModel = readPickerModel(planSelect.value, planCustom?.value || "");
    }
    if (tool === "video" && videoModel) {
      const desc = body.querySelector("[data-cp-model-desc]");
      if (desc) desc.textContent = videoModel.description || "";
    }
    if ((tool === "carousel" || tool === "image") && imageModel) {
      const desc = body.querySelector("[data-cp-model-desc]");
      if (desc) desc.textContent = imageModel.description || "";
    }
  }

  function bindProduceSettings(item: PlanItem) {
    modal.classList.add("content-plan-modal--settings");
    body.querySelectorAll<HTMLSelectElement>("[data-cp-run]").forEach((select) => {
      select.addEventListener("change", () => {
        const imageSelect = body.querySelector<HTMLSelectElement>("[data-cp-image-model]");
        const sizeSelect = body.querySelector<HTMLSelectElement>("[data-cp-image-size]");
        const videoSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-model]");
        const durationSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-duration]");
        const resolutionSelect = body.querySelector<HTMLSelectElement>("[data-cp-video-resolution]");
        const planSelect = body.querySelector<HTMLSelectElement>("[data-cp-plan-model]");
        const planCustom = body.querySelector<HTMLInputElement>("[data-cp-plan-custom]");
        const planWrap = body.querySelector<HTMLElement>("[data-cp-plan-custom-wrap]");
        if (imageSelect) produceRun.imageModel = imageSelect.value;
        if (videoSelect) produceRun.videoModel = videoSelect.value;
        if (select.hasAttribute("data-cp-image-model") || select.hasAttribute("data-cp-video-model")) {
          applyProduceSettings(item);
        }
        if (sizeSelect) produceRun.imageSize = sizeSelect.value;
        if (durationSelect) produceRun.duration = durationSelect.value;
        if (resolutionSelect) produceRun.resolution = resolutionSelect.value;
        if (planSelect) {
          const custom = planSelect.value === CUSTOM_VALUE;
          if (planWrap) planWrap.hidden = !custom;
          produceRun.planModel = readPickerModel(planSelect.value, planCustom?.value || "");
        }
        void refreshProduceEstimate(item);
      });
    });
    body.querySelector<HTMLInputElement>("[data-cp-plan-custom]")?.addEventListener("change", () => {
      const planSelect = body.querySelector<HTMLSelectElement>("[data-cp-plan-model]");
      const planCustom = body.querySelector<HTMLInputElement>("[data-cp-plan-custom]");
      produceRun.planModel = readPickerModel(planSelect?.value || "", planCustom?.value || "");
      void refreshProduceEstimate(item);
    });
    body.querySelector<HTMLSelectElement>("[data-cp-break-count]")?.addEventListener("change", (event) => {
      const value = Number((event.target as HTMLSelectElement).value);
      if (Number.isFinite(value)) produceBreakTakeCount = value;
    });
    body.querySelector<HTMLInputElement>("[data-cp-use-brand-identity]")?.addEventListener("change", (event) => {
      produceRun.useBrandIdentity = (event.target as HTMLInputElement).checked;
      void refreshProduceEstimate(item);
    });
    const logoToggle = body.querySelector<HTMLInputElement>("[data-cp-use-brand-logo]");
    const appearanceWrap = body.querySelector<HTMLElement>("[data-cp-logo-appearance-wrap]");
    const appearanceInput = body.querySelector<HTMLTextAreaElement>("[data-cp-logo-appearance]");
    logoToggle?.addEventListener("change", (event) => {
      produceRun.useBrandLogo = (event.target as HTMLInputElement).checked;
      if (appearanceWrap) appearanceWrap.hidden = !produceRun.useBrandLogo;
      if (produceRun.useBrandLogo && appearanceInput && !appearanceInput.value.trim()) {
        appearanceInput.value = DEFAULT_LOGO_APPEARANCE;
        produceRun.logoAppearance = appearanceInput.value;
      }
      void refreshProduceEstimate(item);
    });
    appearanceInput?.addEventListener("change", () => {
      produceRun.logoAppearance = appearanceInput.value;
    });
    appearanceInput?.addEventListener("input", () => {
      produceRun.logoAppearance = appearanceInput.value;
    });
    body.querySelectorAll<HTMLButtonElement>("[data-cp-settings-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.cpSettingsTab;
        body.querySelectorAll<HTMLButtonElement>("[data-cp-settings-tab]").forEach((itemBtn) => {
          const active = itemBtn.dataset.cpSettingsTab === tab;
          itemBtn.classList.toggle("active", active);
          itemBtn.setAttribute("aria-selected", String(active));
        });
        body.querySelectorAll<HTMLElement>("[data-cp-settings-pane]").forEach((pane) => {
          pane.hidden = pane.dataset.cpSettingsPane !== tab;
        });
      });
    });
  }

  function paintProduceSettings(item: PlanItem, options?: { estimate?: boolean }) {
    const tool = toolForFormat(item.format || "");
    const llmPane =
      tool === "carousel"
        ? `
          <div class="imagens-studio-settings-switch" role="tablist" aria-label="Settings">
            <button type="button" class="active" role="tab" data-cp-settings-tab="run" aria-selected="true">Run settings</button>
            <button type="button" role="tab" data-cp-settings-tab="llm" aria-selected="false">LLM settings</button>
          </div>`
        : "";
    const runPane =
      tool === "video"
        ? `
          <div class="imagens-studio-settings-pane" data-cp-settings-pane="run">
            <label>Model
              <select data-cp-run data-cp-video-model></select>
            </label>
            <p class="imagens-model-desc" data-cp-model-desc></p>
            <label>Video duration
              <select data-cp-run data-cp-video-duration></select>
            </label>
            <label>Resolution
              <select data-cp-run data-cp-video-resolution></select>
            </label>
            <p class="meta">Proporção travada em 9:16.</p>
            ${paintProduceHooksButton()}
            ${paintProduceBreak()}
          </div>`
        : `
          <div class="imagens-studio-settings-pane" data-cp-settings-pane="run">
            <label>Model
              <select data-cp-run data-cp-image-model></select>
            </label>
            <p class="imagens-model-desc" data-cp-model-desc></p>
            <label>Resolution
              <select data-cp-run data-cp-image-size></select>
            </label>
            <p class="meta">Proporção travada em 4:5.</p>
          </div>`;
    const planPane =
      tool === "carousel"
        ? `
          <div class="imagens-studio-settings-pane" data-cp-settings-pane="llm" hidden>
            <p class="imagens-model-desc">Modelo do roteiro dos slides. A geração das imagens usa as Run settings.</p>
            <label>Plan model
              <select data-cp-run data-cp-plan-model></select>
            </label>
            <label data-cp-plan-custom-wrap hidden>Modelo personalizado
              <input data-cp-plan-custom placeholder="gemini-…" />
            </label>
          </div>`
        : "";
    const estimate = options?.estimate
      ? `<div class="content-plan-estimate" data-cp-estimate>
          <p class="content-plan-cost">${escapeHtml(produceEstimateLabel())}</p>
        </div>`
      : "";
    return `
      <aside class="imagens-studio-settings content-plan-settings is-open" aria-label="Settings">
        ${llmPane}
        ${runPane}
        ${planPane}
        ${paintProduceBrand()}
        ${estimate}
      </aside>
    `;
  }

  function paintProduceBrand(): string {
    const hasLogo = Boolean(produceBrand?.logoImageId);
    const showAppearance = hasLogo && produceRun.useBrandLogo;
    const appearance = produceRun.logoAppearance || DEFAULT_LOGO_APPEARANCE;
    return `<div class="content-plan-brand">
      <label class="content-plan-brand-check">
        <input type="checkbox" data-cp-use-brand-identity ${
          produceRun.useBrandIdentity ? "checked" : ""
        } />
        Usar identidade
      </label>
      <label class="content-plan-brand-check">
        <input type="checkbox" data-cp-use-brand-logo ${
          produceRun.useBrandLogo ? "checked" : ""
        } ${hasLogo ? "" : "disabled"} />
        Usar logo
      </label>
      ${
        hasLogo
          ? ""
          : `<p class="meta">Configure o logo em Identidade da marca.</p>`
      }
      ${
        hasLogo
          ? `<label data-cp-logo-appearance-wrap ${showAppearance ? "" : "hidden"}>
        Como o logo aparece
        <textarea data-cp-logo-appearance rows="2" maxlength="400" placeholder="${escapeHtml(DEFAULT_LOGO_APPEARANCE)}">${escapeHtml(appearance)}</textarea>
      </label>`
          : ""
      }
    </div>`;
  }

  function paintProduceBreak(): string {
    return `<div class="content-plan-break">
      <label>Quebrar em
        <select data-cp-break-count>
          ${[2, 3, 4, 5]
            .map(
              (n) =>
                `<option value="${n}"${produceBreakTakeCount === n ? " selected" : ""}>${n} vídeos</option>`,
            )
            .join("")}
        </select>
      </label>
      <button type="button" class="secondary" data-cp-break-takes>Quebrar em N vídeos</button>
      <p class="movies-hint">A IA parte o roteiro em clips de ~8–10s. Depois você gera take a take.</p>
    </div>`;
  }

  function selectedProduceVideoHook(): ProduceVideoHook | undefined {
    return (produceVideoHooks || []).find((item) => item.id === produceRun.videoHookId);
  }

  function paintProduceHooksButton(): string {
    const selected = selectedProduceVideoHook();
    return `<div class="content-plan-hooks-field" data-cp-hooks-field>
      <span>Hook visual</span>
      <button type="button" class="content-plan-hooks-btn${produceRun.videoHookId ? " is-active" : ""}" data-cp-hooks>
        <span class="content-plan-hooks-btn__copy">
          <strong>${escapeHtml(selected?.title || "Nenhum")}</strong>
          <small>${selected ? "Linguagem da geração" : "Câmera, físico e mundo"}</small>
        </span>
      </button>
    </div>`;
  }

  function refreshProduceHooksButton() {
    const field = body.querySelector("[data-cp-hooks-field]");
    if (field) field.outerHTML = paintProduceHooksButton();
  }

  function paintProduceHooksList() {
    const list = modal.querySelector<HTMLElement>("[data-cp-hooks-list]");
    if (!list) return;
    const hooks = produceVideoHooks || [];
    const groups = new Map<string, ProduceVideoHook[]>();
    for (const hook of hooks) {
      const key = hook.group || "Hooks";
      const bucket = groups.get(key) || [];
      bucket.push(hook);
      groups.set(key, bucket);
    }
    const noneActive = !produceRun.videoHookId;
    const cards = [...groups.entries()]
      .map(([group, items]) => {
        const options = items
          .map((item) => {
            const active = item.id === produceRun.videoHookId;
            return `<button type="button" class="content-plan-hook-card${active ? " is-active" : ""}" data-cp-hook-id="${escapeHtml(item.id)}" aria-pressed="${active ? "true" : "false"}">
              <strong>${escapeHtml(item.title || "")}</strong>
              ${item.summary ? `<span>${escapeHtml(item.summary)}</span>` : ""}
              ${item.example ? `<em>${escapeHtml(item.example)}</em>` : ""}
            </button>`;
          })
          .join("");
        return `<p class="content-plan-legend">${escapeHtml(group)}</p><div class="content-plan-hook-grid">${options}</div>`;
      })
      .join("");
    list.innerHTML = `
      <button type="button" class="content-plan-hook-card${noneActive ? " is-active" : ""}" data-cp-hook-id="" aria-pressed="${noneActive ? "true" : "false"}">
        <strong>Nenhum</strong>
        <span>Gerar só com o briefing da peça${produceRun.characterId ? " e o personagem" : ""}.</span>
      </button>
      ${cards || `<p class="movies-hint">Não carregou os hooks.</p>`}
    `;
  }

  function closeProduceHooks() {
    const picker = modal.querySelector<HTMLElement>("[data-cp-hooks-modal]");
    if (picker) picker.hidden = true;
  }

  function openProduceHooks() {
    const picker = modal.querySelector<HTMLElement>("[data-cp-hooks-modal]");
    if (!picker) return;
    paintProduceHooksList();
    picker.hidden = false;
  }

  function applyProduceVideoHook(id: string) {
    produceRun.videoHookId = id;
    closeProduceHooks();
    refreshProduceHooksButton();
  }

  async function loadProduceVideoHooks() {
    try {
      if (!produceVideoHooks) {
        const res = await api("/content-plan/video-hooks");
        if (!res.ok) throw new Error("Não carregou os hooks");
        produceVideoHooks = (await res.json()) as ProduceVideoHook[];
      }
      if (produceRun.videoHookId && !selectedProduceVideoHook()) {
        produceRun.videoHookId = "";
      }
      refreshProduceHooksButton();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não carregou os hooks");
    }
  }

  function paintProduceBrief(item: PlanItem, withEstimate = false, withRewrite = withEstimate) {
    const steps = (item.structure || [])
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join("");
    const videoTakes = item.videoTakes || [];
    const takesList = videoTakes.length
      ? `<div class="content-plan-planned-takes">
          <p class="content-plan-legend">Takes planejadas</p>
          <ul>
            ${videoTakes
              .map((take) => {
                const done = Boolean(take.studioAssetId);
                const canGenerate = !done && Boolean(take.id) && item.status !== "scheduled";
                return `<li class="${done ? "is-done" : ""}">
                  <strong>${escapeHtml(take.label || take.id || "Take")}</strong>
                  <span>${escapeHtml(take.beat || "")}</span>
                  ${
                    canGenerate
                      ? `<button type="button" class="secondary" data-cp-generate-take="${escapeHtml(take.id)}">Gerar esta take</button>`
                      : done
                        ? `<em>Gerada</em>`
                        : ""
                  }
                </li>`;
              })
              .join("")}
          </ul>
        </div>`
      : "";
    return `
      <article class="content-plan-item">
        <p class="content-plan-tool">${escapeHtml(toolLabel(item.format || ""))}</p>
        <p class="cal-idea-kicker">${escapeHtml(formatWhen(item.scheduledAt))} · ${escapeHtml(formatLabel(item.format || ""))}</p>
        <strong>${escapeHtml(item.title || "")}</strong>
        ${item.hook ? `<p>${escapeHtml(item.hook)}</p>` : ""}
        ${
          steps
            ? `<p class="content-plan-legend">Estrutura</p><ol class="content-plan-structure">${steps}</ol>`
            : ""
        }
        ${item.visualDirection ? `<p class="meta">${escapeHtml(item.visualDirection)}</p>` : ""}
        ${item.cta ? `<p class="content-plan-cta">${escapeHtml(item.cta)}</p>` : ""}
        ${item.caption ? `<p class="meta">${escapeHtml(item.caption)}</p>` : ""}
        ${
          withRewrite
            ? `<form class="content-plan-rewrite" data-cp-rewrite>
          <label>O que mudar no roteiro?
            <textarea name="note" rows="2" maxlength="800" required placeholder="Ex.: mais direto, fale da dor da agenda vazia"></textarea>
          </label>
          <button type="submit" class="secondary" data-cp-rewrite-submit>Regerar script</button>
        </form>`
            : ""
        }
        ${takesList}
        ${
          withEstimate
            ? `<div class="content-plan-estimate" data-cp-estimate>
          <p class="content-plan-cost">Estimando custo…</p>
        </div>`
            : ""
        }
      </article>
    `;
  }

  function paintProduceCreate(_plan: ContentPlan, item: PlanItem) {
    setHeading("Criar peça");
    produceEstimateMode = "create";
    const tool = toolForFormat(item.format || "");
    if (tool === "video" && !produceRun.characterId && item.characterId) {
      produceRun.characterId = item.characterId;
      produceRun.characterAssetId = item.characterAssetId || "";
    }
    if (tool === "video" && !produceRun.videoHookId && item.videoHookId) {
      produceRun.videoHookId = item.videoHookId;
    }
    const pendingTake = (item.videoTakes || []).find((take) => take.id && !take.studioAssetId);
    const createLabel = pendingTake
      ? `Gerar próxima take`
      : (item.videoTakes || []).length
        ? "Ver takes geradas"
        : "Confirmar criação";
    modal.classList.add("content-plan-modal--settings");
    body.innerHTML = `
      <div class="content-plan-result content-plan-result--create">
        ${paintProduceProgress("create")}
        <div class="content-plan-create-main">
          <div class="content-plan-result__scroll">
            <p class="content-plan-lede">${
              pendingTake
                ? "Gere as takes uma a uma. Cada clip dura ~8–10s."
                : (item.videoTakes || []).length
                  ? "Todas as takes planejadas já têm vídeo. Revise e escolha na agenda."
                  : `Usaremos ${escapeHtml(toolLabel(item.format || ""))} com este briefing. Confirme para gerar.`
            }</p>
            ${
              tool === "video"
                ? `<section class="content-plan-cast" data-cp-cast>
              <p class="content-plan-legend">Personagem</p>
              <p class="lead-share-hint">Carregando personagens…</p>
            </section>`
                : ""
            }
            ${paintProduceBrief(item, true)}
          </div>
          <div class="actions content-plan-nav">
            <button type="button" class="secondary" data-cp-produce-back>Voltar</button>
            ${
              (item.videoTakes || []).length && !pendingTake
                ? `<button type="button" data-cp-produce-preview>Revisar takes</button>`
                : `<button type="button" data-cp-produce-create>${escapeHtml(createLabel)}</button>`
            }
          </div>
        </div>
        ${paintProduceSettings(item)}
      </div>
    `;
    bindProduceSettings(item);
    body.querySelector("[data-cp-rewrite]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void rewriteProduceItem();
    });
    if (tool === "video") {
      void loadProduceCharacters();
      void loadProduceVideoHooks();
    }
    void ensureProduceCatalogs().then(() => {
      applyProduceSettings(item);
      void refreshProduceEstimate(item);
    });
  }

  function paintProduceCharacterPicker() {
    const box = body.querySelector<HTMLElement>("[data-cp-cast]");
    if (!box) return;
    box.innerHTML = `
      <p class="content-plan-legend">Personagem</p>
      ${produceCharacterPickerHtml(
        produceCharacters || [],
        produceRun.characterId,
        produceRun.characterAssetId,
      )}
    `;
    box.querySelectorAll<HTMLButtonElement>("[data-character-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.characterId || "";
        if (!id) {
          produceRun.characterId = "";
          produceRun.characterAssetId = "";
          paintProduceCharacterPicker();
          return;
        }
        openProduceCharacterPicker(id);
      });
    });
  }

  function closeProduceCharacterPicker() {
    const picker = modal.querySelector<HTMLElement>("[data-cp-character-modal]");
    if (picker) picker.hidden = true;
  }

  function openProduceCharacterPicker(characterId: string) {
    const character = (produceCharacters || []).find((item) => item.id === characterId);
    if (!character) return;
    const picker = modal.querySelector<HTMLElement>("[data-cp-character-modal]");
    const title = modal.querySelector<HTMLElement>("#content-plan-character-title");
    const statusEl = modal.querySelector<HTMLElement>("[data-cp-character-status]");
    const grid = modal.querySelector<HTMLElement>("[data-cp-character-grid]");
    const remove = modal.querySelector<HTMLButtonElement>("[data-cp-character-remove]");
    if (!picker || !title || !statusEl || !grid || !remove) return;

    const images = characterImageAssets(character);
    const currentAssetId =
      (produceRun.characterId === characterId ? produceRun.characterAssetId : "") ||
      characterHero(character)?.id ||
      "";
    title.textContent = `Escolha a foto de ${character.name}`;
    statusEl.textContent = images.length
      ? "A imagem escolhida entra como quadro inicial do vídeo."
      : "Este personagem ainda não tem imagens. Gere ou envie uma foto em Personagens.";
    grid.innerHTML = images
      .map((asset) => {
        const src = previewSrcFromLocalPath(asset.localPath);
        const selected = asset.id === currentAssetId;
        return `<button type="button" class="videos-picker-card movies-character-image-option${selected ? " is-active" : ""}" data-cp-character-asset="${escapeHtml(asset.id || "")}" aria-pressed="${selected ? "true" : "false"}" aria-label="Usar ${escapeHtml(asset.filename || asset.kind || "foto")}">
          ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(asset.filename || character.name)}" />` : ""}
          <span>${escapeHtml(asset.filename || asset.kind || "foto")}</span>
        </button>`;
      })
      .join("");
    remove.hidden = produceRun.characterId !== characterId;
    picker.hidden = false;
    picker.dataset.characterId = characterId;
  }

  function applyProduceCharacterAsset(assetId: string) {
    const picker = modal.querySelector<HTMLElement>("[data-cp-character-modal]");
    const characterId = picker?.dataset.characterId || "";
    if (!characterId || !assetId) return;
    produceRun.characterId = characterId;
    produceRun.characterAssetId = assetId;
    closeProduceCharacterPicker();
    paintProduceCharacterPicker();
  }

  function clearProduceCharacter() {
    produceRun.characterId = "";
    produceRun.characterAssetId = "";
    closeProduceCharacterPicker();
    paintProduceCharacterPicker();
  }

  async function loadProduceCharacters() {
    try {
      if (!produceCharacters) {
        const res = await api("/creative/characters");
        if (!res.ok) throw new Error("Não carregou os personagens");
        produceCharacters = (await res.json()) as CreativeCharacter[];
      }
      const selected = (produceCharacters || []).find(
        (item) => item.id === produceRun.characterId,
      );
      if (produceRun.characterId && !selected) {
        produceRun.characterId = "";
        produceRun.characterAssetId = "";
      } else if (
        produceRun.characterAssetId &&
        !characterAssetById(selected, produceRun.characterAssetId)
      ) {
        produceRun.characterAssetId = characterHero(selected)?.id || "";
      } else if (produceRun.characterId && !produceRun.characterAssetId) {
        produceRun.characterAssetId = characterHero(selected)?.id || "";
      }
      paintProduceCharacterPicker();
    } catch (error) {
      const box = body.querySelector<HTMLElement>("[data-cp-cast]");
      if (box) {
        box.innerHTML = `<p class="content-plan-legend">Personagem</p><p class="movies-hint">${escapeHtml(
          error instanceof Error ? error.message : "Não carregou os personagens",
        )}</p>`;
      }
    }
  }

  function paintProducePreview(_plan: ContentPlan, item: PlanItem) {
    setHeading(item.status === "scheduled" ? "Na agenda" : "Revisar criação");
    const tool = toolForFormat(item.format || "");
    if (tool === "video" && !produceRun.characterId && item.characterId) {
      produceRun.characterId = item.characterId;
      produceRun.characterAssetId = item.characterAssetId || "";
    }
    if (tool === "video" && !produceRun.videoHookId && item.videoHookId) {
      produceRun.videoHookId = item.videoHookId;
    }
    const stored = item.previewUrls || [];
    const initial = stored.filter(isStoragePreview);
    const needsResolve =
      Boolean(item.studioProjectId && item.studioAssetIds?.length) &&
      (stored.length !== initial.length || !initial.length);
    const media = initial.length
      ? producePreviewHtml(item, initial)
      : needsResolve
        ? `<p class="lead-share-hint">Carregando mídia…</p>`
        : `<p class="lead-share-hint">Sem mídia gerada.</p>`;
    const scheduled = item.status === "scheduled";
    const split = tool === "video" && (item.videoTakes || []).length > 0;
    const showSettings = !scheduled && tool === "video";
    const canRegen = showSettings && !split;
    const pendingTakes = (item.videoTakes || []).filter((take) => take.id && !take.studioAssetId);
    const itemId = item.id || "";
    const lede = scheduled
      ? "Esta peça já está na agenda para postagem programada."
      : tool === "video" && pendingTakes.length
        ? "A take gerada continua na lista. Gere a próxima sem apagar as anteriores."
        : tool === "video" && split
          ? "Escolha a take que vai para a agenda."
          : tool === "video"
            ? "Escolha a take que vai para a agenda. Ajuste o modelo à direita para regerar sem apagar as anteriores."
            : "Confira o conteúdo gerado e adicione na agenda.";
    const actions = `
        <div class="actions content-plan-nav">
          <button type="button" class="secondary" data-cp-produce-back>Voltar</button>
          ${canRegen ? `<button type="button" class="secondary" data-cp-produce-regen>Regerar vídeo</button>` : ""}
          ${
            scheduled
              ? `<button type="button" class="secondary" data-cp-list>Planos</button>`
              : `<button type="button" data-cp-produce-schedule>Adicionar na agenda</button>`
          }
        </div>`;
    if (showSettings) {
      produceEstimateMode = canRegen ? "regen" : "create";
      modal.classList.add("content-plan-modal--settings");
      body.innerHTML = `
      <div class="content-plan-result content-plan-result--create">
        ${paintProduceProgress("preview")}
        <div class="content-plan-create-main">
          <div class="content-plan-result__scroll">
            <p class="content-plan-lede">${lede}</p>
            ${paintProduceBrief(item, false, !scheduled)}
            <div class="content-plan-preview">${media}</div>
          </div>
          ${actions}
        </div>
        ${paintProduceSettings(item, { estimate: true })}
      </div>
    `;
      bindProduceSettings(item);
      void loadProduceVideoHooks();
      void ensureProduceCatalogs().then(() => {
        if (produceItemId !== itemId) return;
        applyProduceSettings(item);
        void refreshProduceEstimate(item);
      });
    } else {
      body.innerHTML = `
      <div class="content-plan-result">
        ${paintProduceProgress("preview")}
        <div class="content-plan-result__scroll">
          <p class="content-plan-lede">${lede}</p>
          ${paintProduceBrief(item, false, !scheduled)}
          <div class="content-plan-preview">${media}</div>
        </div>
        ${actions}
      </div>
    `;
    }
    body.querySelector("[data-cp-rewrite]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void rewriteProduceItem();
    });
    if (!needsResolve) return;
    void resolveProducePreviewUrls(item).then((urls) => {
      if (produceItemId !== itemId) return;
      const box = body.querySelector(".content-plan-preview");
      if (box) box.innerHTML = producePreviewHtml(item, urls);
    });
  }

  function keepIdsFromForm() {
    return [...body.querySelectorAll<HTMLInputElement>('input[name="keep"]:checked')]
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  async function selectProduceItems() {
    if (!draft?.id || busy) return;
    const keepIds = [
      ...new Set([
        ...keepIdsFromForm(),
        ...(draft.items || [])
          .filter((item) => item.status === "created" || item.status === "scheduled")
          .map((item) => String(item.id || "").trim())
          .filter(Boolean),
      ]),
    ];
    if (!keepIds.length) {
      setStatus("Escolha ao menos uma peça.");
      return;
    }
    busy = true;
    setStatus("Salvando seleção…");
    try {
      const res = await api(`/content-plan/${encodeURIComponent(draft.id)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepIds }),
      });
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não salvou a seleção"));
      produceView = "list";
      produceItemId = null;
      setStatus("");
      openProduce(payload, "list");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function rewriteProduceItem() {
    if (!draft?.id || !produceItemId || busy) return;
    const form = body.querySelector<HTMLFormElement>("[data-cp-rewrite]");
    const note = String(form?.querySelector<HTMLTextAreaElement>("textarea")?.value || "").trim();
    if (note.length < 3) {
      setStatus("Diga o que mudar no roteiro.");
      form?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    busy = true;
    setStatus("Reescrevendo o roteiro…");
    try {
      const res = await api(
        `/content-plan/${encodeURIComponent(draft.id)}/items/${encodeURIComponent(produceItemId)}/rewrite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note,
            planModel: produceRun.planModel,
            videoHookId: produceRun.videoHookId || "",
          }),
        },
      );
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não reescreveu o roteiro"));
      setStatus("Roteiro atualizado.");
      openProduce(payload, "create", produceItemId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function breakProduceTakes() {
    if (!draft?.id || !produceItemId || busy) return;
    const count = produceBreakTakeCount;
    busy = true;
    setStatus(`Partindo o roteiro em ${count} takes…`);
    try {
      const res = await api(
        `/content-plan/${encodeURIComponent(draft.id)}/items/${encodeURIComponent(produceItemId)}/break-takes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            takeCount: count,
            planModel: produceRun.planModel,
            videoHookId: produceRun.videoHookId || "",
          }),
        },
      );
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não partiu o roteiro"));
      setStatus(`Roteiro partido em ${count} takes.`);
      openProduce(payload, "create", produceItemId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function createProduceItem(mode: "create" | "regen" = "create", takeId?: string) {
    if (!draft?.id || !produceItemId || busy) return;
    const item = findProduceItem(draft, produceItemId);
    if (
      mode === "create" &&
      item &&
      (item.videoTakes || []).length &&
      !(item.videoTakes || []).some((take) => take.id && !take.studioAssetId) &&
      !takeId
    ) {
      openProduce(draft, "preview", produceItemId);
      return;
    }
    if (produceRun.useBrandLogo && !produceRun.logoAppearance.trim()) {
      setStatus("Descreva como o logo aparece.");
      return;
    }
    busy = true;
    setStatus(mode === "regen" ? "Regerando vídeo…" : takeId ? "Gerando take…" : "Gerando conteúdo…");
    try {
      const bodyPayload = item ? produceRunPayload(item, takeId) : {};
      const res = await api(
        `/content-plan/${encodeURIComponent(draft.id)}/items/${encodeURIComponent(produceItemId)}/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        },
      );
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não gerou o conteúdo"));
      const nextItem = findProduceItem(payload, produceItemId);
      const stillPending = (nextItem?.videoTakes || []).some(
        (take) => take.id && !take.studioAssetId,
      );
      setStatus(
        mode === "regen"
          ? "Nova take gerada."
          : stillPending
            ? "Take gerada. Pode gerar a próxima."
            : "Conteúdo gerado.",
      );
      openProduce(payload, stillPending && mode === "create" ? "create" : "preview", produceItemId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function selectProduceTake(assetId: string) {
    if (!draft?.id || !produceItemId || busy || !assetId) return;
    const item = findProduceItem(draft, produceItemId);
    if (!item || item.selectedStudioAssetId === assetId) return;
    busy = true;
    setStatus("Selecionando take…");
    try {
      const res = await api(
        `/content-plan/${encodeURIComponent(draft.id)}/items/${encodeURIComponent(produceItemId)}/media`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedStudioAssetId: assetId }),
        },
      );
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não selecionou a take"));
      setStatus("Take escolhida para a agenda.");
      openProduce(payload, "preview", produceItemId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function scheduleProduceItem() {
    if (!draft?.id || !produceItemId || busy) return;
    busy = true;
    setStatus("Adicionando na agenda…");
    try {
      const res = await api(
        `/content-plan/${encodeURIComponent(draft.id)}/items/${encodeURIComponent(produceItemId)}/schedule`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não agendou"));
      setStatus("Peça na agenda.");
      openProduce(payload, "list");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  function goProduceBack() {
    if (produceView === "select") {
      paintList();
      return;
    }
    if (produceView === "list") {
      produceView = "select";
      produceItemId = null;
      paintProduce();
      return;
    }
    produceView = "list";
    produceItemId = null;
    paintProduce();
  }

  async function loadOpen() {
    if (!leadId) {
      setStatus("Selecione um perfil.");
      body.innerHTML = `<p class="lead-share-hint">Selecione um lead ou cliente para planejar.</p>`;
      return;
    }
    setStatus("Carregando…");
    body.innerHTML = `<p class="prompt-hint">Abrindo a skill…</p>`;
    try {
      const res = await api(`/content-plan/open?${ownerQuery()}`);
      const data = (await res.json()) as OpenPayload;
      if (!res.ok) throw new Error(readError(data, "Não abriu o planejamento"));
      setStatus("");
      if (!data.ready) {
        paintGate(data.reason);
        return;
      }
      clientContext = data.context || null;
      previousPlan = data.previousPlan || null;
      savedPlans = data.plans?.length ? data.plans : data.plan ? [data.plan] : [];
      const pending = data.draft || savedPlans.find(isDraftPlan) || null;
      try {
        if (pending) {
          draft = pending;
          if (!savedPlans.some((item) => item.id === pending.id)) {
            savedPlans = [pending, ...savedPlans];
          }
          paintPlan(pending, "preview");
        } else if (savedPlans.length) {
          paintList();
        } else {
          paintForm();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao montar o formulário";
        setStatus(message);
        body.innerHTML = `<p class="lead-share-hint">${escapeHtml(message)}</p>`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha";
      setStatus(message);
      body.innerHTML = `<p class="lead-share-hint">${escapeHtml(message)}</p>`;
    }
  }

  async function generate(event: Event) {
    event.preventDefault();
    if (!leadId || busy) return;
    const form = host.querySelector<HTMLFormElement>("[data-cp-form]");
    if (!form) return;
    const data = new FormData(form);
    const formats = [...form.querySelectorAll<HTMLInputElement>('input[name="format"]:checked')].map(
      (input) => input.value,
    );
    const objectives = [
      ...form.querySelectorAll<HTMLInputElement>('input[name="objective"]:checked'),
    ].map((input) => input.value);
    if (!objectives.length) {
      setStatus("Escolha até três objetivos.");
      return;
    }
    if (!formats.length) {
      setStatus("Escolha ao menos um tipo de post.");
      return;
    }
    busy = true;
    setStatus("Gerando plano…");
    const submit = host.querySelector<HTMLButtonElement>("[data-cp-generate]");
    if (submit) submit.disabled = true;
    try {
      const res = await api("/content-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ownerBody(),
          objectives,
          goalNote: String(data.get("goalNote") || "").trim(),
          tones: [...form.querySelectorAll<HTMLInputElement>('input[name="tone"]:checked')].map(
            (input) => input.value,
          ),
          promote: String(data.get("promote") || "").trim(),
          avoid: String(data.get("avoid") || "").trim(),
          contextOverrides: {
            segment: String(data.get("segment") || "").trim(),
            audience: String(data.get("audience") || "").trim(),
            voice: String(data.get("voice") || "").trim(),
          },
          postsPerWeek: Number(data.get("postsPerWeek") || 3),
          weeks: Number(data.get("weeks") || 4),
          formats,
          formatMix: String(data.get("formatMix") || "ai"),
          startsOn: String(data.get("startsOn") || "").trim(),
          usePreviousPlan: Boolean(data.get("usePreviousPlan")),
        }),
      });
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok || !payload.id) {
        throw new Error(readError(payload, "Não gerou o plano"));
      }
      draft = payload;
      savedPlans = [
        payload,
        ...savedPlans.filter((item) => item.id !== payload.id && !isDraftPlan(item)),
      ];
      setStatus("Revise a estratégia e os briefings. Confirme ou descarte.");
      paintPlan(payload, "preview");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
      if (submit) submit.disabled = false;
    } finally {
      busy = false;
    }
  }

  async function confirm() {
    if (!draft?.id || busy) return;
    busy = true;
    setStatus("Confirmando…");
    try {
      const res = await api(`/content-plan/${encodeURIComponent(draft.id)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok) throw new Error(readError(payload, "Não confirmou"));
      draft = payload;
      savedPlans = [payload, ...savedPlans.filter((item) => item.id !== payload.id)];
      setStatus("Plano salvo. Escolha as peças para produzir.");
      openProduce(payload, "select");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  async function discard() {
    if (!draft?.id || busy) return;
    busy = true;
    setStatus("Descartando…");
    try {
      const res = await api(`/content-plan/${encodeURIComponent(draft.id)}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string | string[] };
        throw new Error(readError(payload, "Não descartou"));
      }
      savedPlans = savedPlans.filter((item) => item.id !== draft?.id);
      draft = null;
      setStatus("");
      if (savedPlans.length) paintList();
      else paintForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
    } finally {
      busy = false;
    }
  }

  host.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-cp-hooks-close]")) {
      closeProduceHooks();
      return;
    }
    if (node.matches("[data-cp-hooks-modal]")) {
      closeProduceHooks();
      return;
    }
    if (node.closest("[data-cp-character-close]")) {
      closeProduceCharacterPicker();
      return;
    }
    if (node.matches("[data-cp-character-modal]")) {
      closeProduceCharacterPicker();
      return;
    }
    if (node.closest("[data-cp-character-remove]")) {
      clearProduceCharacter();
      return;
    }
    const characterAsset = node.closest("[data-cp-character-asset]") as HTMLElement | null;
    if (characterAsset && characterAsset.closest("[data-cp-character-modal]")) {
      applyProduceCharacterAsset(characterAsset.dataset.cpCharacterAsset || "");
      return;
    }
    const hookCard = node.closest("[data-cp-hook-id]") as HTMLElement | null;
    if (hookCard && hookCard.closest("[data-cp-hooks-modal]")) {
      applyProduceVideoHook(hookCard.dataset.cpHookId || "");
      return;
    }
    if (node.closest("[data-cp-hooks]")) {
      void loadProduceVideoHooks().then(() => openProduceHooks());
      return;
    }
    if (node.closest("[data-cp-close]")) {
      close();
      return;
    }
    if (node.closest("[data-cp-review]")) {
      opts?.onOpenReport?.();
      return;
    }
    if (node.closest("[data-cp-confirm]")) {
      void confirm();
      return;
    }
    if (node.closest("[data-cp-discard]")) {
      void discard();
      return;
    }
    if (node.closest("[data-cp-produce-next]")) {
      void selectProduceItems();
      return;
    }
    if (node.closest("[data-cp-produce-back]")) {
      if (!busy) goProduceBack();
      return;
    }
    if (node.closest("[data-cp-produce-create]")) {
      void createProduceItem("create");
      return;
    }
    if (node.closest("[data-cp-produce-preview]")) {
      if (!busy && draft && produceItemId) openProduce(draft, "preview", produceItemId);
      return;
    }
    if (node.closest("[data-cp-break-takes]")) {
      void breakProduceTakes();
      return;
    }
    const generateTake = node.closest("[data-cp-generate-take]") as HTMLElement | null;
    if (generateTake?.dataset.cpGenerateTake) {
      void createProduceItem("create", generateTake.dataset.cpGenerateTake);
      return;
    }
    if (node.closest("[data-cp-produce-regen]")) {
      void createProduceItem("regen");
      return;
    }
    const take = node.closest("[data-cp-take-id]") as HTMLElement | null;
    if (take?.dataset.cpTakeId && !node.closest("video")) {
      void selectProduceTake(take.dataset.cpTakeId);
      return;
    }
    if (node.closest("[data-cp-produce-schedule]")) {
      void scheduleProduceItem();
      return;
    }
    const produceProgress = node.closest("[data-cp-produce-progress]") as HTMLElement | null;
    if (produceProgress?.dataset.cpProduceProgress) {
      if (busy) return;
      const target = produceProgress.dataset.cpProduceProgress;
      if (target === "select") {
        produceView = "select";
        produceItemId = null;
        paintProduce();
      } else if (target === "list" && produceView !== "select") {
        produceView = "list";
        produceItemId = null;
        paintProduce();
      }
      return;
    }
    const produceItem = node.closest("[data-cp-produce-item]") as HTMLElement | null;
    if (produceItem?.dataset.cpProduceItem && draft) {
      if (busy) return;
      const item = findProduceItem(draft, produceItem.dataset.cpProduceItem);
      if (!item) return;
      openProduce(
        draft,
        item.status === "created" || item.status === "scheduled" ? "preview" : "create",
        item.id,
      );
      return;
    }
    if (node.closest("[data-cp-next]")) {
      goFormNext();
      return;
    }
    if (node.closest("[data-cp-back]")) {
      goFormBack();
      return;
    }
    const progress = node.closest("[data-cp-progress-item]") as HTMLElement | null;
    if (progress?.dataset.cpProgressItem) {
      const step = Number(progress.dataset.cpProgressItem);
      if (Number.isFinite(step) && step < formStep) showFormStep(step);
      return;
    }
    if (node.closest("[data-cp-new]")) {
      draft = null;
      setStatus("");
      paintForm();
      return;
    }
    if (node.closest("[data-cp-list]")) {
      draft = null;
      setStatus("");
      paintList();
      return;
    }
    const openPlan = node.closest("[data-cp-open]") as HTMLElement | null;
    if (openPlan?.dataset.cpOpen) {
      const plan = savedPlans.find((item) => item.id === openPlan.dataset.cpOpen);
      if (!plan) return;
      draft = plan;
      setStatus("");
      if (isDraftPlan(plan)) paintPlan(plan, "preview");
      else openProduce(plan);
    }
  });

  host.addEventListener("submit", (event) => {
    if (!(event.target as HTMLElement).closest("[data-cp-form]")) return;
    event.preventDefault();
    if (formStep < FORM_STEPS.length - 1) {
      goFormNext();
      return;
    }
    void generate(event);
  });

  return {
    open(id, nextKind = "lead") {
      leadId = id;
      kind = nextKind;
      draft = null;
      savedPlans = [];
      clientContext = null;
      previousPlan = null;
      formStep = 0;
      produceView = "select";
      produceItemId = null;
      produceRun = defaultProduceRun();
      produceBrand = null;
      produceBrandDefaultsApplied = false;
      busy = false;
      setStatus("");
      modal.hidden = false;
      body.innerHTML = `<p class="prompt-hint">Abrindo a skill…</p>`;
      void loadOpen();
    },
    close,
  };
}
