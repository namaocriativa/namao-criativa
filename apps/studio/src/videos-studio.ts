import { api } from "./api";
import { formatChatMarkdown } from "./chat-markdown";
import {
  creativeKindFromRoute,
  renderCreativeKinds,
} from "./creative-kinds";
import {
  creativeSkillFeatures,
  findCreativeFeature,
  isPlaygroundFeature,
} from "./creative/features";
import {
  currentRoute,
  hrefFor,
  navigate,
  titleForRoute,
  type AppRoute,
} from "./router";
import { initStudioSettingsPanel, revealStudioRunSettings } from "./studio-settings-panel";
import type {
  ImageLibraryProject,
  VideoAsset,
  VideoLibraryProject,
  VideoMessage,
  VideoModelDefinition,
  VideoProject,
  VideoProjectSettings,
} from "./types";
import {
  DEFAULT_VIDEO_RUN_SETTINGS,
  estimateVideoRunCost,
  formatVideoCost,
  loadStoredVideoRunSettings,
  notifyVideoRunSettings,
  persistVideoRunSettings,
  setVideoRunCatalog,
  videoCostNote,
  type VideoRunCatalog,
} from "./video-run-settings";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function assetSrc(asset: { localPath?: string } | undefined): string {
  if (!asset?.localPath) return "";
  return `/${asset.localPath.replace(/^\/+/, "")}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function formatDate(value?: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

type Catalog = VideoRunCatalog;

type FrameSlot = "first" | "last";

type FrameSelection = {
  imageAssetId?: string;
  videoAsset?: VideoAsset;
  previewSrc: string;
  label: string;
};

export function initVideosStudio(): {
  onRoute: (route: AppRoute) => void;
} {
  const nameInput = requireEl<HTMLInputElement>("videos-project-name");
  const statusEl = requireEl<HTMLElement>("videos-studio-status");
  const deleteBtn = requireEl<HTMLButtonElement>("videos-project-delete");
  const settingsToggle = requireEl<HTMLButtonElement>("videos-settings-toggle");
  const settingsPanel = requireEl<HTMLElement>("videos-settings");
  initStudioSettingsPanel(settingsPanel);
  const threadEl = requireEl<HTMLElement>("videos-thread");
  const composer = requireEl<HTMLFormElement>("videos-composer");
  const promptEl = requireEl<HTMLTextAreaElement>("videos-prompt");
  const refsEl = requireEl<HTMLElement>("videos-composer-refs");
  const frameInput = requireEl<HTMLInputElement>("videos-frame-input");
  const runBtn = requireEl<HTMLButtonElement>("videos-run-btn");
  const modelChip = requireEl<HTMLElement>("videos-model-chip");
  const modelSelect = requireEl<HTMLSelectElement>("videos-model");
  const modelDesc = requireEl<HTMLElement>("videos-model-desc");
  const aspectSelect = requireEl<HTMLSelectElement>("videos-aspect");
  const durationSelect = requireEl<HTMLSelectElement>("videos-duration");
  const resolutionSelect = requireEl<HTMLSelectElement>("videos-resolution");
  const thinkingSelect = requireEl<HTMLSelectElement>("videos-thinking");
  const thinkingWrap = requireEl<HTMLElement>("videos-thinking-wrap");
  const costEl = requireEl<HTMLElement>("videos-run-cost");
  const costNoteEl = requireEl<HTMLElement>("videos-run-cost-note");
  const historyList = requireEl<HTMLElement>("videos-history-list");
  const historyEmpty = requireEl<HTMLElement>("videos-history-empty");
  const galleryGrid = requireEl<HTMLElement>("videos-gallery-grid");
  const galleryEmpty = requireEl<HTMLElement>("videos-gallery-empty");
  const newConversationBtn = requireEl<HTMLButtonElement>("videos-new-conversation");
  const conversationSearch = requireEl<HTMLInputElement>("videos-conversation-search");
  const conversationList = requireEl<HTMLElement>("videos-conversation-list");
  const kindsEl = requireEl<HTMLElement>("videos-studio-kinds");
  const skillsEl = requireEl<HTMLElement>("videos-studio-skills");
  const pickFirstBtn = requireEl<HTMLButtonElement>("videos-pick-first");
  const pickLastBtn = requireEl<HTMLButtonElement>("videos-pick-last");
  const picker = requireEl<HTMLElement>("videos-image-picker");
  const pickerList = requireEl<HTMLElement>("videos-picker-list");
  const pickerStatus = requireEl<HTMLElement>("videos-picker-status");
  const pickerClose = requireEl<HTMLButtonElement>("videos-picker-close");

  let current: VideoProject | null = null;
  let catalog: Catalog | null = null;
  let busy = false;
  let generating = false;
  let firstFrame: FrameSelection | null = null;
  let lastFrame: FrameSelection | null = null;
  let pickerSlot: FrameSlot = "first";
  let saveTimer = 0;
  let conversations: VideoProject[] = [];
  let conversationQuery = "";
  let libraryItems: VideoLibraryProject[] = [];

  const SKILLS_FOLD_KEY = "videos-skills-open";

  function skillsFoldOpen(): boolean {
    try {
      return localStorage.getItem(SKILLS_FOLD_KEY) !== "0";
    } catch {
      return true;
    }
  }

  function renderSkills(activeId?: string) {
    const items = creativeSkillFeatures("video");
    if (!items.length) {
      skillsEl.innerHTML = "";
      return;
    }
    const open = skillsFoldOpen();
    skillsEl.innerHTML = `<div class="imagens-skills-fold${open ? "" : " is-collapsed"}">
      <button
        type="button"
        class="imagens-skills-toggle"
        aria-expanded="${open ? "true" : "false"}"
        data-skills-toggle
      >
        Habilidades
        <span class="imagens-skills-chevron" aria-hidden="true"></span>
      </button>
      <div class="imagens-skills-list">
        ${items
          .map((feature) => {
            const active = activeId === feature.id;
            return `<a href="${hrefFor({ name: "criativo-skill", id: feature.id })}" class="imagens-skill-link${active ? " active" : ""}">${escapeHtml(feature.title)}</a>`;
          })
          .join("")}
      </div>
    </div>`;
  }

  function renderKinds() {
    renderCreativeKinds(
      kindsEl,
      creativeKindFromRoute(currentRoute()) || "video",
    );
  }

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function currentModel(): VideoModelDefinition | undefined {
    const id = modelSelect.value || current?.settings?.model;
    return catalog?.models.find((model) => model.id === id);
  }

  function readSettings(): VideoProjectSettings {
    return {
      model: modelSelect.value,
      aspectRatio: aspectSelect.value,
      duration: durationSelect.value,
      resolution: resolutionSelect.value,
      thinkingLevel: thinkingSelect.value,
    };
  }

  function fillSelect(
    select: HTMLSelectElement,
    values: string[],
    currentValue: string,
    preferred = "",
  ) {
    const next = values.includes(currentValue)
      ? currentValue
      : values.includes(preferred)
        ? preferred
        : values[0] || "";
    select.innerHTML = values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}"${value === next ? " selected" : ""}>${escapeHtml(value)}</option>`,
      )
      .join("");
    select.value = next;
  }

  function selectHas(select: HTMLSelectElement, value: string) {
    return [...select.options].some((opt) => opt.value === value);
  }

  function clampHighResSelects(prefer: "duration" | "resolution" | "cheap") {
    const model = currentModel();
    const veo =
      model?.generationApi === "predictLongRunning" ||
      (model?.id || "").startsWith("veo-");
    if (!veo) return;
    const high =
      resolutionSelect.value === "1080p" || resolutionSelect.value === "4k";
    if (!high || durationSelect.value === "8s") return;
    if (prefer === "resolution" && selectHas(durationSelect, "8s")) {
      durationSelect.value = "8s";
      return;
    }
    if (selectHas(resolutionSelect, "720p")) {
      resolutionSelect.value = "720p";
      return;
    }
    if (selectHas(durationSelect, "8s")) durationSelect.value = "8s";
  }

  function applyModelCapabilities() {
    const model = currentModel();
    if (!model) return;
    modelDesc.textContent = model.description || "";
    modelChip.textContent = model.label;
    fillSelect(aspectSelect, model.capabilities.aspectRatios, aspectSelect.value);
    fillSelect(
      durationSelect,
      model.capabilities.durations,
      durationSelect.value,
      "8s",
    );
    fillSelect(
      resolutionSelect,
      model.capabilities.resolutions,
      resolutionSelect.value,
      "720p",
    );
    const thinkingLevels = model.capabilities.thinkingLevels || [];
    thinkingWrap.hidden = thinkingLevels.length === 0;
    if (thinkingLevels.length) {
      fillSelect(
        thinkingSelect,
        thinkingLevels,
        thinkingSelect.value,
        "low",
      );
    } else {
      thinkingSelect.innerHTML = "";
      thinkingSelect.value = "";
    }
    clampHighResSelects("cheap");
    updateCostPreview();
  }

  function applySettings(settings: VideoProjectSettings) {
    if (![...modelSelect.options].some((opt) => opt.value === settings.model)) {
      modelSelect.value = catalog?.defaultModelId || settings.model;
    } else {
      modelSelect.value = settings.model;
    }
    applyModelCapabilities();
    if (settings.aspectRatio) aspectSelect.value = settings.aspectRatio;
    if (settings.duration) durationSelect.value = settings.duration;
    if (settings.resolution) resolutionSelect.value = settings.resolution;
    if (settings.thinkingLevel) thinkingSelect.value = settings.thinkingLevel;
    applyModelCapabilities();
    persistAndBroadcast();
  }

  function persistAndBroadcast() {
    const settings = readSettings();
    persistVideoRunSettings(settings);
    updateCostPreview();
    notifyVideoRunSettings();
  }

  function updateCostPreview() {
    if (!catalog) {
      costEl.textContent = "";
      costNoteEl.hidden = true;
      return;
    }
    const settings = readSettings();
    const cost = estimateVideoRunCost(settings, catalog);
    costEl.textContent = formatVideoCost(cost);
    const note = videoCostNote(cost);
    costNoteEl.textContent = note;
    costNoteEl.hidden = !note;
  }

  function hydrateRunSettings() {
    const stored = loadStoredVideoRunSettings();
    applySettings({
      ...DEFAULT_VIDEO_RUN_SETTINGS,
      model: catalog?.defaultModelId || DEFAULT_VIDEO_RUN_SETTINGS.model,
      ...stored,
    });
  }

  function openRunSettings() {
    revealStudioRunSettings(settingsPanel);
    settingsToggle.setAttribute("aria-expanded", "true");
  }

  function populateModels() {
    if (!catalog) return;
    modelSelect.innerHTML = catalog.models
      .map(
        (model) =>
          `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`,
      )
      .join("");
  }

  async function ensureCatalog() {
    if (!catalog) {
      const res = await api("/video-models");
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao carregar modelos"));
      }
      catalog = (await res.json()) as Catalog;
      setVideoRunCatalog(catalog);
      populateModels();
      hydrateRunSettings();
    } else {
      setVideoRunCatalog(catalog);
      applyModelCapabilities();
    }
    return catalog;
  }

  function generatedOf(message: VideoMessage): VideoAsset[] {
    return (message.assets || []).filter((asset) => asset.kind === "generated");
  }

  function framesOf(message: VideoMessage): VideoAsset[] {
    return (message.assets || []).filter(
      (asset) => asset.kind === "first-frame" || asset.kind === "last-frame",
    );
  }

  function renderThread(pendingPrompt?: string) {
    const messages = current?.messages || [];
    const blocks: string[] = [];
    if (!messages.length && !pendingPrompt) {
      blocks.push(
        `<p class="imagens-empty">Converse com a LLM. O vídeo só é gerado depois que você confirmar a proposta.</p>`,
      );
    }
    for (const message of messages) {
      if (message.kind === "tool") {
        blocks.push(
          `<p class="imagens-tool-chip">Consultou ${escapeHtml(message.toolName || "tool")}</p>`,
        );
        continue;
      }
      if (message.kind === "proposal") {
        if (message.status === "pending") {
          blocks.push(renderProposalCard(message));
        }
        continue;
      }
      if (message.role === "user") {
        const frames = framesOf(message)
          .map((asset) => {
            const src = assetSrc(asset);
            const label = asset.kind === "last-frame" ? "Last frame" : "Starting frame";
            return `<span class="videos-frame-chip">
              <img src="${escapeHtml(src)}" alt="" />
              <em>${label}</em>
            </span>`;
          })
          .join("");
        blocks.push(
          `<article class="imagens-msg imagens-msg--user" id="videos-msg-${escapeHtml(message.id)}">
            ${frames ? `<div class="videos-msg-frames">${frames}</div>` : ""}
            <p>${escapeHtml(visibleText(message))}</p>
            <time>${escapeHtml(formatDate(message.createdAt))}</time>
          </article>`,
        );
        continue;
      }
      const thoughts = message.thoughts
        ? `<details class="imagens-thoughts">
            <summary>Thoughts</summary>
            <pre>${escapeHtml(message.thoughts)}</pre>
          </details>`
        : "";
      const videos = generatedOf(message)
        .map((asset) => {
          const src = assetSrc(asset);
          return `<video class="videos-output" src="${escapeHtml(src)}" controls playsinline></video>`;
        })
        .join("");
      blocks.push(
        `<article class="imagens-msg imagens-msg--model" id="videos-msg-${escapeHtml(message.id)}">
          ${thoughts}
          ${message.text ? `<div class="imagens-msg-body">${formatChatMarkdown(message.text)}</div>` : ""}
          ${videos}
        </article>`,
      );
    }
    if (pendingPrompt) {
      blocks.push(
        `<article class="imagens-msg imagens-msg--user is-pending">
          <p>${escapeHtml(pendingPrompt)}</p>
        </article>
        <article class="imagens-msg imagens-msg--model is-pending">
          <p>Pensando…</p>
        </article>`,
      );
    }
    threadEl.innerHTML = blocks.join("");
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function visibleText(message: VideoMessage): string {
    const text = String(message.text || "");
    const cut = text.indexOf("\n\n[");
    return cut >= 0 ? text.slice(0, cut) : text;
  }

  function formatUsage(usage: VideoMessage["usage"]): string {
    if (!usage?.totalTokens && !usage?.promptTokens) return "";
    const total = usage.totalTokens ?? (usage.promptTokens || 0) + (usage.candidatesTokens || 0);
    return `${total} tokens`;
  }

  function renderProposalCard(message: VideoMessage): string {
    const spec = (message.settings || {}) as Record<string, unknown>;
    const prompt = String(spec.prompt || message.text || "");
    const model = String(spec.model || current?.settings?.model || "");
    const meta = [model, spec.aspectRatio, spec.duration, spec.resolution]
      .filter(Boolean)
      .join(" · ");
    const estimated = Number(spec.estimatedTokens) || 0;
    const chatUsage = formatUsage(message.usage);
    const lead = String(spec.leadLabel || spec.leadId || "");
    const rationale = String(spec.rationale || "");
    return `<article class="imagens-proposal" data-proposal-id="${escapeHtml(message.id)}">
      <p class="criativo-kicker">Confirmar geração</p>
      <label>Prompt
        <textarea rows="5" data-proposal-prompt>${escapeHtml(prompt)}</textarea>
      </label>
      <p class="imagens-proposal-meta">${escapeHtml(meta)}</p>
      <p class="imagens-proposal-meta">Estimativa: ${estimated} tokens${chatUsage ? ` · chat ${escapeHtml(chatUsage)}` : ""}</p>
      ${lead ? `<p class="imagens-proposal-meta">Lead: ${escapeHtml(lead)}</p>` : ""}
      ${rationale ? `<div class="imagens-msg-body">${formatChatMarkdown(rationale)}</div>` : ""}
      <div class="imagens-proposal-actions">
        <button type="button" data-proposal-confirm="${escapeHtml(message.id)}">Confirmar</button>
        <button type="button" class="danger" data-proposal-cancel="${escapeHtml(message.id)}">Cancelar</button>
      </div>
    </article>`;
  }

  function renderHistory() {
    const messages = current?.messages || [];
    const items = messages
      .map((message, index) => {
        if (message.role !== "user") return "";
        const next =
          messages[index + 1]?.role === "model" ? messages[index + 1] : undefined;
        const thumb = next ? generatedOf(next)[0] : undefined;
        const src = assetSrc(thumb);
        const thumbHtml = src
          ? `<video src="${escapeHtml(src)}" muted playsinline></video>`
          : `<span class="imagens-history-thumb-empty"></span>`;
        return `<li>
          <button type="button" data-jump-message="${escapeHtml(message.id)}">
            ${thumbHtml}
            <span>
              <strong>${escapeHtml(message.text || "Prompt")}</strong>
              <em>${escapeHtml(formatDate(message.createdAt))}</em>
            </span>
          </button>
        </li>`;
      })
      .filter(Boolean);
    historyEmpty.hidden = items.length > 0;
    historyList.innerHTML = items.join("");
  }

  function renderGallery() {
    const assets = libraryItems.flatMap((project) =>
      (project.assets || []).map((asset) => ({ project, asset })),
    );
    galleryEmpty.hidden = assets.length > 0;
    galleryGrid.innerHTML = assets
      .map(({ project, asset }) => {
        const src = assetSrc(asset);
        return `<li>
          <video src="${escapeHtml(src)}" controls playsinline></video>
          <div class="imagens-gallery-actions">
            <a class="button-link outline" href="/criativo/videos/${encodeURIComponent(project.id)}">${escapeHtml(project.name)}</a>
            <a class="button-link outline" href="${escapeHtml(src)}" download>Baixar</a>
          </div>
        </li>`;
      })
      .join("");
  }

  function renderConversations() {
    const needle = conversationQuery.trim().toLowerCase();
    const items = conversations.filter((item) => {
      if (!needle) return true;
      return (item.name || "").toLowerCase().includes(needle);
    });
    conversationList.innerHTML = items
      .map((item) => {
        const active = current?.id === item.id;
        const thumb = assetSrc(item.assets?.[0]);
        return `<li>
          <a href="/criativo/videos/${encodeURIComponent(item.id)}" class="${active ? "active" : ""}">
            ${thumb ? `<video src="${escapeHtml(thumb)}" muted playsinline></video>` : `<span class="imagens-history-thumb-empty"></span>`}
            <span>
              <strong>${escapeHtml(item.name || "Conversa")}</strong>
              <em>${escapeHtml(formatDate(item.updatedAt))}</em>
            </span>
          </a>
        </li>`;
      })
      .join("");
  }

  function renderRefs() {
    const chips: string[] = [];
    if (firstFrame) {
      chips.push(
        `<span class="imagens-ref-chip videos-frame-chip--labeled">
          <img src="${escapeHtml(firstFrame.previewSrc)}" alt="" />
          <em>Start</em>
          <button type="button" data-remove-frame="first" aria-label="Remover quadro inicial">×</button>
        </span>`,
      );
    }
    if (lastFrame) {
      chips.push(
        `<span class="imagens-ref-chip videos-frame-chip--labeled">
          <img src="${escapeHtml(lastFrame.previewSrc)}" alt="" />
          <em>End</em>
          <button type="button" data-remove-frame="last" aria-label="Remover quadro final">×</button>
        </span>`,
      );
    }
    refsEl.innerHTML = chips.join("");
  }

  function renderProject(project: VideoProject) {
    current = project;
    nameInput.value = project.name || "";
    document.title = titleForRoute(
      { name: "videos-project", id: project.id },
      project.name,
    );
    if (project.settings) applySettings(project.settings);
    renderThread();
    renderHistory();
    renderGallery();
    renderRefs();
    renderConversations();
    deleteBtn.hidden = false;
    nameInput.disabled = false;
  }

  function startBlank() {
    current = null;
    firstFrame = null;
    lastFrame = null;
    nameInput.value = "Nova conversa";
    nameInput.disabled = true;
    deleteBtn.hidden = true;
    renderThread();
    renderRefs();
    renderConversations();
    setStatus("");
  }

  function showView(view: "playground" | "gallery" | "skill") {
    document.querySelectorAll<HTMLElement>("[data-videos-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.videosView === view);
    });
    document.querySelectorAll<HTMLElement>("[data-videos-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.videosPane !== view;
    });
  }

  async function saveSettings(extra: Partial<VideoProject> = {}) {
    if (!current?.id || busy) return;
    const payload = { name: nameInput.value.trim() || current.name, ...readSettings(), ...extra };
    try {
      const res = await api(`/video-projects/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao salvar"));
      const project = (await res.json()) as VideoProject;
      current = { ...current, ...project, messages: project.messages || current.messages };
      nameInput.value = current.name;
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar configurações"), true);
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveSettings();
    }, 400);
  }

  async function loadProject(id: string) {
    setStatus("Carregando conversa…");
    firstFrame = null;
    lastFrame = null;
    showView("playground");
    closePicker();
    try {
      await ensureCatalog();
      const res = await api(`/video-projects/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(await readError(res, "Conversa não encontrada"));
      const project = (await res.json()) as VideoProject;
      renderProject(project);
      setStatus("");
    } catch (error) {
      current = null;
      setStatus(errorMessage(error, "Falha ao carregar conversa"), true);
    }
  }

  async function loadConversations() {
    try {
      const res = await api("/creative/llm/conversations?kind=video");
      if (!res.ok) throw new Error(await readError(res, "Falha ao listar conversas"));
      conversations = (await res.json()) as VideoProject[];
      renderConversations();
    } catch {
      conversations = [];
      renderConversations();
    }
  }

  async function loadLibrary() {
    try {
      const res = await api("/video-projects/library");
      if (!res.ok) throw new Error(await readError(res, "Falha ao carregar library"));
      libraryItems = (await res.json()) as VideoLibraryProject[];
      renderGallery();
    } catch {
      libraryItems = [];
      renderGallery();
    }
  }

  function generatePayload() {
    const payload: Record<string, unknown> = {
      prompt: promptEl.value.trim(),
      ...readSettings(),
    };
    if (firstFrame?.imageAssetId) payload.firstFrameImageAssetId = firstFrame.imageAssetId;
    else if (firstFrame?.videoAsset?.id) payload.firstFrameAssetId = firstFrame.videoAsset.id;
    if (lastFrame?.imageAssetId) payload.lastFrameImageAssetId = lastFrame.imageAssetId;
    else if (lastFrame?.videoAsset?.id) payload.lastFrameAssetId = lastFrame.videoAsset.id;
    return payload;
  }

  async function sendTurn(event: Event) {
    event.preventDefault();
    if (generating) return;
    const prompt = promptEl.value.trim();
    if (!prompt) {
      setStatus("Escreva uma mensagem", true);
      return;
    }
    if (lastFrame && !firstFrame) {
      setStatus("Quadro final exige um quadro inicial", true);
      return;
    }
    generating = true;
    runBtn.disabled = true;
    setStatus("Pensando…");
    renderThread(prompt);
    try {
      const extras = generatePayload();
      const res = await api("/creative/llm/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          conversationId: current?.id,
          text: prompt,
          firstFrameImageAssetId: extras.firstFrameImageAssetId,
          lastFrameImageAssetId: extras.lastFrameImageAssetId,
          firstFrameAssetId: extras.firstFrameAssetId,
          lastFrameAssetId: extras.lastFrameAssetId,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha no chat"));
      const body = (await res.json()) as {
        conversation: VideoProject;
        usage?: { totalTokens?: number };
      };
      promptEl.value = "";
      renderProject(body.conversation);
      await loadConversations();
      if (!window.location.pathname.includes(body.conversation.id)) {
        navigate({ name: "videos-project", id: body.conversation.id }, { replace: true });
      }
      const tokens = body.usage?.totalTokens;
      setStatus(tokens ? `Turno · ${tokens} tokens` : "");
    } catch (error) {
      renderThread();
      setStatus(errorMessage(error, "Falha no chat"), true);
    } finally {
      generating = false;
      runBtn.disabled = false;
    }
  }

  async function uploadFrame(slot: FrameSlot, files: FileList | File[]) {
    if (!current?.id) {
      setStatus("Envie a primeira mensagem para anexar um quadro", true);
      return;
    }
    const list = Array.from(files);
    if (!list.length) return;
    const body = new FormData();
    body.append("slot", slot === "first" ? "first-frame" : "last-frame");
    body.append("files", list[0]);
    setStatus("Enviando quadro…");
    try {
      const res = await api(
        `/video-projects/${encodeURIComponent(current.id)}/frames`,
        { method: "POST", body },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha no upload"));
      const assets = (await res.json()) as VideoAsset[];
      const asset = assets[0];
      if (!asset) throw new Error("Upload vazio");
      const selection: FrameSelection = {
        videoAsset: asset,
        previewSrc: assetSrc(asset),
        label: asset.filename || slot,
      };
      if (slot === "first") firstFrame = selection;
      else lastFrame = selection;
      current.assets = [...(current.assets || []), asset];
      renderRefs();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha no upload"), true);
    } finally {
      frameInput.value = "";
    }
  }

  async function deleteAsset(assetId: string) {
    if (!current?.id) return;
    if (!confirm("Excluir este vídeo?")) return;
    try {
      const res = await api(
        `/video-projects/${encodeURIComponent(current.id)}/assets/${encodeURIComponent(assetId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      current.assets = (current.assets || []).filter((asset) => asset.id !== assetId);
      current.messages = (current.messages || []).map((message) => ({
        ...message,
        assets: (message.assets || []).filter((asset) => asset.id !== assetId),
      }));
      renderThread();
      renderHistory();
      renderGallery();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir vídeo"), true);
    }
  }

  async function deleteProject() {
    if (!current?.id || busy) return;
    if (!confirm("Excluir esta conversa e todos os vídeos gerados?")) return;
    busy = true;
    try {
      const res = await api(`/video-projects/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      navigate({ name: "criativo", kind: "video" });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir projeto"), true);
    } finally {
      busy = false;
    }
  }

  function closePicker() {
    picker.hidden = true;
  }

  async function openPicker(slot: FrameSlot) {
    pickerSlot = slot;
    picker.hidden = false;
    pickerStatus.textContent = "Carregando imagens…";
    pickerList.innerHTML = "";
    try {
      const res = await api("/image-projects/library");
      if (!res.ok) throw new Error(await readError(res, "Falha ao listar imagens"));
      const projects = (await res.json()) as ImageLibraryProject[];
      if (!projects.length) {
        pickerStatus.textContent =
          "Nenhuma imagem gerada ainda. Crie imagens no Studio Criativo.";
        return;
      }
      pickerStatus.textContent =
        slot === "first"
          ? "Escolha o quadro inicial"
          : "Escolha o quadro final";
      pickerList.innerHTML = projects
        .map((project) => {
          const cards = project.assets
            .map((asset) => {
              const src = assetSrc(asset);
              return `<button type="button" class="videos-picker-card" data-image-asset="${escapeHtml(asset.id)}" data-image-src="${escapeHtml(src)}" data-image-name="${escapeHtml(asset.filename)}">
                <img src="${escapeHtml(src)}" alt="" />
              </button>`;
            })
            .join("");
          return `<section class="videos-picker-project">
            <h4>${escapeHtml(project.name)}</h4>
            <div class="videos-picker-grid">${cards}</div>
          </section>`;
        })
        .join("");
    } catch (error) {
      pickerStatus.textContent = errorMessage(error, "Falha ao listar imagens");
    }
  }

  document.querySelectorAll<HTMLButtonElement>("[data-videos-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.videosView;
      if (view === "playground" || view === "gallery") {
        showView(view);
        if (view === "gallery") void loadLibrary();
      }
    });
  });

  settingsToggle.addEventListener("click", () => {
    const open = !settingsPanel.classList.contains("is-open");
    settingsPanel.classList.toggle("is-open", open);
    settingsToggle.setAttribute("aria-expanded", String(open));
  });

  modelSelect.addEventListener("change", () => {
    applyModelCapabilities();
    persistAndBroadcast();
    scheduleSave();
  });
  aspectSelect.addEventListener("change", () => {
    persistAndBroadcast();
    scheduleSave();
  });
  durationSelect.addEventListener("change", () => {
    clampHighResSelects("duration");
    persistAndBroadcast();
    scheduleSave();
  });
  resolutionSelect.addEventListener("change", () => {
    clampHighResSelects("resolution");
    persistAndBroadcast();
    scheduleSave();
  });
  thinkingSelect.addEventListener("change", () => {
    persistAndBroadcast();
    scheduleSave();
  });
  nameInput.addEventListener("change", () => void saveSettings());
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveSettings();
    }
  });

  composer.addEventListener("submit", (event) => void sendTurn(event));
  promptEl.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      composer.requestSubmit();
    }
  });
  pickFirstBtn.addEventListener("click", () => void openPicker("first"));
  pickLastBtn.addEventListener("click", () => void openPicker("last"));
  pickerClose.addEventListener("click", () => closePicker());
  picker.addEventListener("click", (event) => {
    if (event.target === picker) closePicker();
  });
  pickerList.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-image-asset]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.imageAsset) return;
    const selection: FrameSelection = {
      imageAssetId: btn.dataset.imageAsset,
      previewSrc: btn.dataset.imageSrc || "",
      label: btn.dataset.imageName || "Imagem",
    };
    if (pickerSlot === "first") firstFrame = selection;
    else lastFrame = selection;
    renderRefs();
    closePicker();
  });
  frameInput.addEventListener("change", () => {
    if (frameInput.files?.length) {
      const slot: FrameSlot = firstFrame ? "last" : "first";
      void uploadFrame(slot, frameInput.files);
    }
  });
  refsEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-remove-frame]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.removeFrame) return;
    if (btn.dataset.removeFrame === "first") firstFrame = null;
    if (btn.dataset.removeFrame === "last") lastFrame = null;
    renderRefs();
  });
  historyList.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-jump-message]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.jumpMessage) return;
    showView("playground");
    document.getElementById(`videos-msg-${btn.dataset.jumpMessage}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
  galleryGrid.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-delete-asset]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.deleteAsset) return;
    event.preventDefault();
    void deleteAsset(btn.dataset.deleteAsset);
  });
  deleteBtn.addEventListener("click", () => void deleteProject());
  newConversationBtn.addEventListener("click", () => {
    navigate({ name: "criativo", kind: "video" });
  });
  skillsEl.addEventListener("click", (event) => {
    const toggle = (event.target as HTMLElement | null)?.closest("[data-skills-toggle]");
    if (!toggle) return;
    const fold = skillsEl.querySelector(".imagens-skills-fold");
    if (!(fold instanceof HTMLElement)) return;
    const open = fold.classList.contains("is-collapsed");
    fold.classList.toggle("is-collapsed", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    try {
      localStorage.setItem(SKILLS_FOLD_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  });
  conversationSearch.addEventListener("input", () => {
    conversationQuery = conversationSearch.value;
    renderConversations();
  });
  threadEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const confirmBtn = target?.closest("[data-proposal-confirm]") as HTMLElement | null;
    if (confirmBtn?.dataset.proposalConfirm) {
      void confirmProposal(confirmBtn.dataset.proposalConfirm);
      return;
    }
    const cancelBtn = target?.closest("[data-proposal-cancel]") as HTMLElement | null;
    if (cancelBtn?.dataset.proposalCancel) {
      void cancelProposal(cancelBtn.dataset.proposalCancel);
    }
  });

  async function confirmProposal(proposalId: string) {
    if (!current?.id || generating) return;
    const card = threadEl.querySelector(`[data-proposal-id="${proposalId}"]`);
    const textarea = card?.querySelector("[data-proposal-prompt]") as HTMLTextAreaElement | null;
    generating = true;
    setStatus("Gerando vídeo…");
    try {
      if (textarea?.value.trim()) {
        const patch = await api(
          `/creative/llm/conversations/${encodeURIComponent(current.id)}/proposals/${encodeURIComponent(proposalId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: textarea.value.trim() }),
          },
        );
        if (!patch.ok) throw new Error(await readError(patch, "Falha ao editar proposta"));
      }
      const res = await api(
        `/creative/llm/conversations/${encodeURIComponent(current.id)}/proposals/${encodeURIComponent(proposalId)}/confirm`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
      const body = (await res.json()) as { conversation: VideoProject };
      renderProject(body.conversation);
      await loadConversations();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao confirmar"), true);
    } finally {
      generating = false;
    }
  }

  async function cancelProposal(proposalId: string) {
    if (!current?.id) return;
    try {
      const res = await api(
        `/creative/llm/conversations/${encodeURIComponent(current.id)}/proposals/${encodeURIComponent(proposalId)}/cancel`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao cancelar"));
      const body = (await res.json()) as { proposal: VideoMessage };
      current.messages = (current.messages || []).map((message) =>
        message.id === proposalId ? { ...message, ...body.proposal } : message,
      );
      renderThread();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao cancelar"), true);
    }
  }

  function onRoute(route: AppRoute) {
    renderKinds();
    void ensureCatalog().catch((error) => {
      setStatus(errorMessage(error, "Falha ao carregar modelos"), true);
    });
    void loadConversations();
    if (route.name === "videos-project") {
      renderSkills();
      showView("playground");
      void loadProject(route.id);
      return;
    }
    if (route.name === "criativo-skill") {
      const feature = findCreativeFeature(route.id);
      if (!feature || feature.kind !== "video" || isPlaygroundFeature(route.id)) {
        return;
      }
      startBlank();
      nameInput.value = feature.title;
      showView("skill");
      renderSkills(route.id);
      openRunSettings();
      document.title = titleForRoute(route, feature.title);
      return;
    }
    if (
      route.name === "videos" ||
      (route.name === "criativo" && route.kind === "video")
    ) {
      startBlank();
      showView("playground");
      renderSkills();
    }
    closePicker();
  }

  return { onRoute };
}
