import { api } from "./api";
import { formatChatMarkdown } from "./chat-markdown";
import {
  creativeSkillFeatures,
  findCreativeFeature,
  isPlaygroundFeature,
} from "./creative/features";
import {
  creativeKindFromRoute,
  renderCreativeKinds,
} from "./creative-kinds";
import {
  currentRoute,
  hrefFor,
  navigate,
  titleForRoute,
  type AppRoute,
} from "./router";
import { initStudioSettingsPanel } from "./studio-settings-panel";
import type {
  ImageAsset,
  ImageLibraryProject,
  ImageMessage,
  ImageModelDefinition,
  ImageProject,
  ImageProjectSettings,
  ImageSkillRun,
} from "./types";

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

function assetSrc(asset: Pick<ImageAsset, "localPath"> | undefined): string {
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

function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
): string | null {
  if (value == null || Number.isNaN(value)) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(value);
  } catch {
    return `${currency || "BRL"} ${value}`;
  }
}

function isSkillProject(project: ImageProject | null | undefined): boolean {
  return Boolean(
    project?.settings?.featureId &&
      !isPlaygroundFeature(project.settings.featureId),
  );
}

function conversationTag(project: ImageProject): string {
  const featureId = project.settings?.featureId;
  if (!featureId || isPlaygroundFeature(featureId)) return "";
  return findCreativeFeature(featureId)?.title || "";
}

type Catalog = {
  defaultModelId: string;
  models: ImageModelDefinition[];
};

export function initImagensStudio(): {
  onRoute: (route: AppRoute) => void;
} {
  const nameInput = requireEl<HTMLInputElement>("imagens-project-name");
  const statusEl = requireEl<HTMLElement>("imagens-studio-status");
  const deleteBtn = requireEl<HTMLButtonElement>("imagens-project-delete");
  const settingsToggle = requireEl<HTMLButtonElement>("imagens-settings-toggle");
  const settingsPanel = requireEl<HTMLElement>("imagens-settings");
  initStudioSettingsPanel(settingsPanel);
  const chatPane = requireEl<HTMLElement>("imagens-chat-pane");
  const threadEl = requireEl<HTMLElement>("imagens-thread");
  const composer = requireEl<HTMLFormElement>("imagens-composer");
  const promptEl = requireEl<HTMLTextAreaElement>("imagens-prompt");
  const refsEl = requireEl<HTMLElement>("imagens-composer-refs");
  const modelSelect = requireEl<HTMLSelectElement>("imagens-model");
  const modelDesc = requireEl<HTMLElement>("imagens-model-desc");
  const systemEl = requireEl<HTMLTextAreaElement>("imagens-system");
  const temperatureEl = requireEl<HTMLInputElement>("imagens-temperature");
  const temperatureValue = requireEl<HTMLElement>("imagens-temperature-value");
  const aspectSelect = requireEl<HTMLSelectElement>("imagens-aspect");
  const resolutionSelect = requireEl<HTMLSelectElement>("imagens-resolution");
  const personSelect = requireEl<HTMLSelectElement>("imagens-person-generation");
  const personWrap = requireEl<HTMLElement>("imagens-person-generation-wrap");
  const thinkingSelect = requireEl<HTMLSelectElement>("imagens-thinking");
  const thinkingWrap = requireEl<HTMLElement>("imagens-thinking-wrap");
  const includeThoughtsEl = requireEl<HTMLInputElement>("imagens-include-thoughts");
  const includeThoughtsWrap = requireEl<HTMLElement>("imagens-include-thoughts-wrap");
  const googleSearchEl = requireEl<HTMLInputElement>("imagens-google-search");
  const imageSearchEl = requireEl<HTMLInputElement>("imagens-image-search");
  const imageSearchWrap = requireEl<HTMLElement>("imagens-image-search-wrap");
  const historyList = requireEl<HTMLElement>("imagens-history-list");
  const historyEmpty = requireEl<HTMLElement>("imagens-history-empty");
  const galleryGrid = requireEl<HTMLElement>("imagens-gallery-grid");
  const galleryEmpty = requireEl<HTMLElement>("imagens-gallery-empty");
  const newConversationBtn = requireEl<HTMLButtonElement>("imagens-new-conversation");
  const conversationSearch = requireEl<HTMLInputElement>("imagens-conversation-search");
  const conversationList = requireEl<HTMLElement>("imagens-conversation-list");
  const kindsEl = requireEl<HTMLElement>("imagens-studio-kinds");
  const skillsEl = requireEl<HTMLElement>("imagens-studio-skills");

  let current: ImageProject | null = null;
  let catalog: Catalog | null = null;
  let busy = false;
  let generating = false;
  let attachedRefs: ImageAsset[] = [];
  let saveTimer = 0;
  let conversations: ImageProject[] = [];
  let conversationQuery = "";
  let libraryItems: ImageLibraryProject[] = [];

  function renderKinds() {
    renderCreativeKinds(
      kindsEl,
      creativeKindFromRoute(currentRoute()) || "image",
    );
  }

  const SKILLS_FOLD_KEY = "imagens-skills-open";

  function skillsFoldOpen(): boolean {
    try {
      return localStorage.getItem(SKILLS_FOLD_KEY) !== "0";
    } catch {
      return true;
    }
  }

  function renderSkills(activeId?: string) {
    const items = creativeSkillFeatures("image");
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

  function syncComposerVisibility(view: "playground" | "gallery" | "skill") {
    composer.hidden = view !== "playground" || isSkillProject(current);
  }

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function currentModel(): ImageModelDefinition | undefined {
    const id = modelSelect.value || current?.settings?.model;
    return catalog?.models.find((model) => model.id === id);
  }

  function readSettings(): ImageProjectSettings {
    const model = currentModel();
    return {
      model: modelSelect.value,
      temperature: Number(temperatureEl.value) || 1,
      aspectRatio: aspectSelect.value,
      imageSize: resolutionSelect.value,
      systemInstruction: systemEl.value,
      googleSearch: Boolean(googleSearchEl.checked && model?.capabilities.googleSearch),
      imageSearch: Boolean(imageSearchEl.checked && model?.capabilities.imageSearch),
      personGeneration: personSelect.value,
      thinkingLevel: thinkingSelect.value,
      includeThoughts: Boolean(
        includeThoughtsEl.checked && model?.capabilities.thinking,
      ),
    };
  }

function fillSelect(
  select: HTMLSelectElement,
  values: readonly string[],
  currentValue: string,
  labels?: Record<string, string>,
) {
  const next = values.includes(currentValue) ? currentValue : values[0] || "";
  select.innerHTML = values
    .map((value) => {
      const label = labels?.[value] || value;
      return `<option value="${escapeHtml(value)}"${value === next ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
  select.value = next;
}

const PERSON_GENERATION_LABELS: Record<string, string> = {
  ALLOW_NONE: "No people",
  ALLOW_ADULT: "Adults only",
  ALLOW_ALL: "All people",
};

const THINKING_LEVEL_LABELS: Record<string, string> = {
  minimal: "Minimal",
  high: "High",
};

  function applyModelCapabilities() {
    const model = currentModel();
    if (!model) return;
    modelDesc.textContent = model.description || "";
    fillSelect(aspectSelect, model.capabilities.aspectRatios, aspectSelect.value);
    fillSelect(
      resolutionSelect,
      model.capabilities.resolutions,
      resolutionSelect.value,
    );
    const personGenerations = model.capabilities.personGenerations || [];
    personWrap.hidden = personGenerations.length === 0;
    if (personGenerations.length) {
      fillSelect(
        personSelect,
        personGenerations,
        personSelect.value,
        PERSON_GENERATION_LABELS,
      );
    }
    const thinkingLevels = model.capabilities.thinkingLevels || [];
    thinkingWrap.hidden = thinkingLevels.length === 0;
    if (thinkingLevels.length) {
      fillSelect(
        thinkingSelect,
        thinkingLevels,
        thinkingSelect.value,
        THINKING_LEVEL_LABELS,
      );
    }
    includeThoughtsWrap.hidden = !model.capabilities.thinking;
    if (!model.capabilities.thinking) includeThoughtsEl.checked = false;
    const searchWrap = googleSearchEl.closest("label");
    if (searchWrap instanceof HTMLElement) {
      searchWrap.hidden = !model.capabilities.googleSearch;
    }
    if (!model.capabilities.googleSearch) googleSearchEl.checked = false;
    imageSearchWrap.hidden = !model.capabilities.imageSearch;
    if (!model.capabilities.imageSearch) imageSearchEl.checked = false;
    systemEl.disabled = !model.capabilities.systemInstruction;
  }

  function applySettings(settings: ImageProjectSettings) {
    if (![...modelSelect.options].some((opt) => opt.value === settings.model)) {
      modelSelect.value = catalog?.defaultModelId || settings.model;
    } else {
      modelSelect.value = settings.model;
    }
    systemEl.value = settings.systemInstruction || "";
    temperatureEl.value = String(settings.temperature ?? 1);
    temperatureValue.textContent = String(settings.temperature ?? 1);
    googleSearchEl.checked = Boolean(settings.googleSearch);
    imageSearchEl.checked = Boolean(settings.imageSearch);
    includeThoughtsEl.checked = Boolean(settings.includeThoughts);
    applyModelCapabilities();
    if (settings.aspectRatio) aspectSelect.value = settings.aspectRatio;
    if (settings.imageSize) resolutionSelect.value = settings.imageSize;
    if (settings.personGeneration) personSelect.value = settings.personGeneration;
    if (settings.thinkingLevel) thinkingSelect.value = settings.thinkingLevel;
    applyModelCapabilities();
  }

  function populateModels() {
    if (!catalog) return;
    const selected = modelSelect.value || catalog.defaultModelId;
    modelSelect.innerHTML = catalog.models
      .map(
        (model) =>
          `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`,
      )
      .join("");
    modelSelect.value = catalog.models.some((model) => model.id === selected)
      ? selected
      : catalog.defaultModelId;
    applyModelCapabilities();
  }

  async function ensureCatalog() {
    if (catalog) {
      applyModelCapabilities();
      return catalog;
    }
    const res = await api("/image-models");
    if (!res.ok) {
      throw new Error(await readError(res, "Falha ao carregar modelos"));
    }
    catalog = (await res.json()) as Catalog;
    populateModels();
    return catalog;
  }

  function generatedOf(message: ImageMessage): ImageAsset[] {
    return (message.assets || []).filter((asset) => asset.kind === "generated");
  }

  function renderSkillRecap(): string {
    const featureId = current?.settings?.featureId || "";
    const feature = findCreativeFeature(featureId);
    const run = current?.settings?.skillRun as ImageSkillRun | undefined;
    const generated = (current?.messages || []).flatMap((message) => generatedOf(message));
    const images = generated
      .map((asset) => {
        const src = assetSrc(asset);
        if (!src) return "";
        return `<a class="imagens-output" href="${escapeHtml(src)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(src)}" alt="" />
        </a>`;
      })
      .join("");
    const spec = (run?.spec || {}) as Record<string, unknown>;
    const packages = (run?.packages || [])
      .map((pkg) => {
        const full = formatMoney(pkg.price, pkg.currency);
        const promo = formatMoney(pkg.promoPrice, pkg.currency);
        const price = full && promo ? `de ${full} por ${promo}` : full || promo || "";
        return `<li><strong>${escapeHtml(pkg.name)}</strong>${price ? `<em>${escapeHtml(price)}</em>` : ""}</li>`;
      })
      .join("");
    const specPackages = Array.isArray(spec.packages)
      ? (spec.packages as Array<Record<string, unknown>>)
          .map((pkg) => {
            const title = String(pkg.title || pkg.label || "");
            const price = [pkg.priceFrom, pkg.priceTo].filter(Boolean).join(" → ");
            if (!title) return "";
            return `<li><strong>${escapeHtml(title)}</strong>${price ? `<em>${escapeHtml(String(price))}</em>` : ""}</li>`;
          })
          .join("")
      : "";
    return `<article class="imagens-skill-recap">
      <p class="criativo-kicker">${escapeHtml(feature?.title || "Habilidade")}</p>
      <h3>${escapeHtml(current?.name || feature?.title || "Resultado")}</h3>
      ${
        run
          ? `<dl class="imagens-skill-meta">
              <div><dt>Lead</dt><dd>${escapeHtml(run.leadLabel || run.leadId)}</dd></div>
              ${
                packages
                  ? `<div><dt>Pacotes</dt><dd><ul>${packages}</ul></dd></div>`
                  : ""
              }
              ${
                run.notes
                  ? `<div><dt>Notas</dt><dd>${escapeHtml(run.notes)}</dd></div>`
                  : ""
              }
            </dl>
            ${
              spec.headline || spec.subhead || spec.cta
                ? `<div class="imagens-skill-copy">
                    ${spec.kicker ? `<p class="criativo-kicker">${escapeHtml(String(spec.kicker))}</p>` : ""}
                    ${spec.headline ? `<p class="imagens-skill-headline">${escapeHtml(String(spec.headline))}</p>` : ""}
                    ${spec.subhead ? `<p>${escapeHtml(String(spec.subhead))}</p>` : ""}
                    ${spec.cta ? `<p><strong>${escapeHtml(String(spec.cta))}</strong></p>` : ""}
                    ${specPackages ? `<ul>${specPackages}</ul>` : ""}
                  </div>`
                : ""
            }`
          : `<p class="imagens-empty">Os inputs desta habilidade não foram salvos neste projeto.</p>`
      }
      <div class="imagens-skill-result">${images || `<p class="imagens-empty">Nenhuma imagem gerada ainda.</p>`}</div>
    </article>`;
  }

  function renderThread(pendingPrompt?: string) {
    if (isSkillProject(current) && !pendingPrompt) {
      threadEl.innerHTML = renderSkillRecap();
      threadEl.scrollTop = 0;
      return;
    }
    const messages = current?.messages || [];
    const blocks: string[] = [];
    if (!messages.length && !pendingPrompt) {
      blocks.push(
        `<p class="imagens-empty imagens-empty--chat">Como posso ajudar hoje?</p>`,
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
        blocks.push(
          `<article class="imagens-msg imagens-msg--user" id="imagens-msg-${escapeHtml(message.id)}">
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
      const images = generatedOf(message)
        .map((asset) => {
          const src = assetSrc(asset);
          return `<a class="imagens-output" href="${escapeHtml(src)}" target="_blank" rel="noreferrer">
            <img src="${escapeHtml(src)}" alt="" />
          </a>`;
        })
        .join("");
      const usage = formatUsage(message.usage);
      blocks.push(
        `<article class="imagens-msg imagens-msg--model" id="imagens-msg-${escapeHtml(message.id)}">
          ${thoughts}
          ${message.text ? `<div class="imagens-msg-body">${formatChatMarkdown(message.text)}</div>` : ""}
          ${images}
          ${usage ? `<em>${escapeHtml(usage)}</em>` : ""}
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

  function visibleText(message: ImageMessage): string {
    const text = String(message.text || "");
    const cut = text.indexOf("\n\n[");
    return cut >= 0 ? text.slice(0, cut) : text;
  }

  function formatUsage(usage: ImageMessage["usage"]): string {
    if (!usage?.totalTokens && !usage?.promptTokens) return "";
    const total = usage.totalTokens ?? (usage.promptTokens || 0) + (usage.candidatesTokens || 0);
    return `${total} tokens`;
  }

  function renderProposalCard(message: ImageMessage): string {
    const spec = (message.settings || {}) as Record<string, unknown>;
    const prompt = String(spec.prompt || message.text || "");
    const model = String(spec.model || current?.settings?.model || "");
    const aspect = String(spec.aspectRatio || current?.settings?.aspectRatio || "");
    const size = String(spec.imageSize || current?.settings?.imageSize || "");
    const estimated = Number(spec.estimatedTokens) || 0;
    const chatUsage = formatUsage(message.usage);
    const lead = String(spec.leadLabel || spec.leadId || "");
    const rationale = String(spec.rationale || "");
    const refs = Array.isArray(spec.referenceAssetIds)
      ? (spec.referenceAssetIds as string[])
      : [];
    const refChips = refs
      .map((id) => {
        const asset = (current?.assets || []).find((item) => item.id === id);
        const src = assetSrc(asset);
        return `<span class="imagens-ref-chip">
          ${src ? `<img src="${escapeHtml(src)}" alt="" />` : ""}
          <button type="button" data-proposal-remove-ref="${escapeHtml(id)}">×</button>
        </span>`;
      })
      .join("");
    return `<article class="imagens-proposal" data-proposal-id="${escapeHtml(message.id)}">
      <p class="criativo-kicker">Confirmar geração</p>
      <label>Prompt
        <textarea rows="5" data-proposal-prompt>${escapeHtml(prompt)}</textarea>
      </label>
      <p class="imagens-proposal-meta">${escapeHtml([model, aspect, size].filter(Boolean).join(" · "))}</p>
      <p class="imagens-proposal-meta">Estimativa: ${estimated} tokens${chatUsage ? ` · chat ${escapeHtml(chatUsage)}` : ""}</p>
      ${lead ? `<p class="imagens-proposal-meta">Lead: ${escapeHtml(lead)}</p>` : ""}
      ${rationale ? `<div class="imagens-msg-body">${formatChatMarkdown(rationale)}</div>` : ""}
      <div class="imagens-composer-refs">${refChips}</div>
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
          ? `<img src="${escapeHtml(src)}" alt="" />`
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
          <a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(asset.filename || "Imagem")}" />
          </a>
          <div class="imagens-gallery-actions">
            <a class="button-link outline" href="${hrefForConversation(project.id)}">${escapeHtml(project.name)}</a>
            <a class="button-link outline" href="${escapeHtml(src)}" download>Baixar</a>
          </div>
        </li>`;
      })
      .join("");
  }

  function hrefForConversation(id: string): string {
    return `/criativo/imagens/${encodeURIComponent(id)}`;
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
        const tag = conversationTag(item);
        return `<li>
          <a href="${hrefForConversation(item.id)}" class="${active ? "active" : ""}">
            ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<span class="imagens-history-thumb-empty"></span>`}
            <span>
              <strong>${escapeHtml(item.name || "Conversa")}</strong>
              ${tag ? `<span class="imagens-conversation-tag">${escapeHtml(tag)}</span>` : ""}
              <em>${escapeHtml(formatDate(item.updatedAt))}</em>
            </span>
          </a>
        </li>`;
      })
      .join("");
  }

  function renderRefs() {
    refsEl.innerHTML = attachedRefs
      .map((asset) => {
        const src = assetSrc(asset);
        return `<span class="imagens-ref-chip">
          <img src="${escapeHtml(src)}" alt="" />
          <button type="button" data-remove-ref="${escapeHtml(asset.id)}" aria-label="Remover referência">×</button>
        </span>`;
      })
      .join("");
  }

  function renderProject(project: ImageProject) {
    current = project;
    nameInput.value = project.name || "";
    document.title = titleForRoute(
      { name: "imagens-project", id: project.id },
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
    syncComposerVisibility("playground");
  }

  function startBlank() {
    current = null;
    attachedRefs = [];
    nameInput.value = "Nova conversa";
    nameInput.disabled = true;
    deleteBtn.hidden = true;
    renderThread();
    renderRefs();
    renderConversations();
    setStatus("");
    syncComposerVisibility("playground");
    autosizePrompt();
  }

  function showView(view: "playground" | "gallery" | "skill") {
    document.querySelectorAll<HTMLElement>("[data-imagens-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.imagensPane !== view;
    });
    syncComposerVisibility(view);
  }

  function autosizePrompt() {
    promptEl.style.height = "auto";
    promptEl.style.height = `${Math.min(Math.max(promptEl.scrollHeight, 72), 220)}px`;
  }

  function imageFilesFrom(data: DataTransfer | null): File[] {
    if (!data) return [];
    const seen = new Set<File>();
    const files = [
      ...Array.from(data.files),
      ...Array.from(data.items).flatMap((item) => {
        const file = item.kind === "file" ? item.getAsFile() : null;
        return file ? [file] : [];
      }),
    ];
    return files.filter((file) => {
      if (seen.has(file) || !/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
        return false;
      }
      seen.add(file);
      return true;
    });
  }

  async function ensureConversation(): Promise<ImageProject> {
    if (current?.id) return current;
    const res = await api("/image-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.value.trim() || "Nova conversa",
        ...readSettings(),
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Falha ao criar conversa"));
    const project = (await res.json()) as ImageProject;
    renderProject(project);
    nameInput.disabled = false;
    await loadConversations();
    navigate({ name: "imagens-project", id: project.id }, { replace: true });
    return project;
  }

  async function saveSettings(extra: Partial<ImageProject> = {}) {
    if (!current?.id || busy) return;
    const payload = { name: nameInput.value.trim() || current.name, ...readSettings(), ...extra };
    try {
      const res = await api(`/image-projects/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao salvar"));
      const project = (await res.json()) as ImageProject;
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
    attachedRefs = [];
    showView("playground");
    try {
      await ensureCatalog();
      const res = await api(`/image-projects/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(await readError(res, "Conversa não encontrada"));
      const project = (await res.json()) as ImageProject;
      renderProject(project);
      setStatus("");
    } catch (error) {
      current = null;
      setStatus(errorMessage(error, "Falha ao carregar conversa"), true);
    }
  }

  async function loadConversations() {
    try {
      const res = await api("/creative/llm/conversations?kind=image");
      if (!res.ok) throw new Error(await readError(res, "Falha ao listar conversas"));
      conversations = (await res.json()) as ImageProject[];
      renderConversations();
    } catch {
      conversations = [];
      renderConversations();
    }
  }

  async function sendTurn(event: Event) {
    event.preventDefault();
    if (generating) return;
    const prompt = promptEl.value.trim();
    if (!prompt) {
      setStatus("Escreva uma mensagem", true);
      return;
    }
    generating = true;
    promptEl.disabled = true;
    setStatus("Pensando…");
    renderThread(prompt);
    try {
      const res = await api("/creative/llm/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          conversationId: current?.id,
          text: prompt,
          referenceAssetIds: attachedRefs.map((asset) => asset.id),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha no chat"));
      const body = (await res.json()) as {
        conversation: ImageProject;
        usage?: { totalTokens?: number };
      };
      promptEl.value = "";
      autosizePrompt();
      renderProject(body.conversation);
      await loadConversations();
      if (!window.location.pathname.includes(body.conversation.id)) {
        navigate({ name: "imagens-project", id: body.conversation.id }, { replace: true });
      }
      const tokens = body.usage?.totalTokens;
      setStatus(tokens ? `Turno · ${tokens} tokens` : "");
    } catch (error) {
      renderThread();
      setStatus(errorMessage(error, "Falha no chat"), true);
    } finally {
      generating = false;
      promptEl.disabled = false;
      autosizePrompt();
      promptEl.focus();
    }
  }

  async function uploadRefs(files: FileList | File[]) {
    const list = Array.from(files).filter((file) =>
      /^image\/(jpeg|png|webp|gif)$/i.test(file.type),
    );
    if (!list.length) {
      setStatus("Solte uma imagem JPEG, PNG, WebP ou GIF", true);
      return;
    }
    try {
      const project = await ensureConversation();
      const model = currentModel();
      const max = model?.capabilities.maxReferences ?? 14;
      if (attachedRefs.length + list.length > max) {
        setStatus(`Este modelo aceita no máximo ${max} referências`, true);
        return;
      }
      const body = new FormData();
      for (const file of list) body.append("files", file);
      setStatus("Enviando referências…");
      const res = await api(
        `/image-projects/${encodeURIComponent(project.id)}/references`,
        { method: "POST", body },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha no upload"));
      const assets = (await res.json()) as ImageAsset[];
      attachedRefs = [...attachedRefs, ...assets];
      current = {
        ...project,
        assets: [...(project.assets || []), ...assets],
      };
      renderRefs();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha no upload"), true);
    }
  }

  async function deleteAsset(assetId: string) {
    if (!current?.id) return;
    if (!confirm("Excluir esta imagem?")) return;
    try {
      const res = await api(
        `/image-projects/${encodeURIComponent(current.id)}/assets/${encodeURIComponent(assetId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      current.assets = (current.assets || []).filter((asset) => asset.id !== assetId);
      current.messages = (current.messages || []).map((message) => ({
        ...message,
        assets: (message.assets || []).filter((asset) => asset.id !== assetId),
      }));
      attachedRefs = attachedRefs.filter((asset) => asset.id !== assetId);
      renderThread();
      renderHistory();
      renderGallery();
      renderRefs();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir imagem"), true);
    }
  }

  async function deleteProject() {
    if (!current?.id || busy) return;
    if (!confirm("Excluir esta conversa e todas as imagens geradas?")) return;
    busy = true;
    try {
      const res = await api(`/image-projects/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      navigate({ name: "criativo", kind: "image" });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir projeto"), true);
    } finally {
      busy = false;
    }
  }

  settingsToggle.addEventListener("click", () => {
    const open = !settingsPanel.classList.contains("is-open");
    settingsPanel.classList.toggle("is-open", open);
    settingsToggle.setAttribute("aria-expanded", String(open));
  });

  modelSelect.addEventListener("change", () => {
    applyModelCapabilities();
    scheduleSave();
  });
  systemEl.addEventListener("input", scheduleSave);
  temperatureEl.addEventListener("input", () => {
    temperatureValue.textContent = temperatureEl.value;
    scheduleSave();
  });
  aspectSelect.addEventListener("change", scheduleSave);
  resolutionSelect.addEventListener("change", scheduleSave);
  personSelect.addEventListener("change", scheduleSave);
  thinkingSelect.addEventListener("change", scheduleSave);
  includeThoughtsEl.addEventListener("change", scheduleSave);
  googleSearchEl.addEventListener("change", scheduleSave);
  imageSearchEl.addEventListener("change", scheduleSave);
  nameInput.addEventListener("change", () => void saveSettings());
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveSettings();
    }
  });

  composer.addEventListener("submit", (event) => void sendTurn(event));
  promptEl.addEventListener("input", autosizePrompt);
  promptEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    composer.requestSubmit();
  });

  let dragDepth = 0;
  function setDropTarget(active: boolean) {
    chatPane.classList.toggle("is-drop-target", active);
  }
  chatPane.addEventListener("dragenter", (event) => {
    if (!imageFilesFrom(event.dataTransfer).length && !event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDepth += 1;
    setDropTarget(true);
  });
  chatPane.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
  chatPane.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) setDropTarget(false);
  });
  chatPane.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDropTarget(false);
    const files = imageFilesFrom(event.dataTransfer);
    if (files.length) void uploadRefs(files);
  });
  chatPane.addEventListener("paste", (event) => {
    const files = imageFilesFrom(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    void uploadRefs(files);
  });
  refsEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-remove-ref]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.removeRef) return;
    attachedRefs = attachedRefs.filter((asset) => asset.id !== btn.dataset.removeRef);
    renderRefs();
  });
  historyList.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("[data-jump-message]") as
      | HTMLElement
      | null;
    if (!btn?.dataset.jumpMessage) return;
    showView("playground");
    document.getElementById(`imagens-msg-${btn.dataset.jumpMessage}`)?.scrollIntoView({
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
    navigate({ name: "criativo", kind: "image" });
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
    setStatus("Gerando imagem…");
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
      const body = (await res.json()) as { conversation: ImageProject };
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
      const body = (await res.json()) as { proposal: ImageMessage };
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
    if (route.name === "imagens-project") {
      renderSkills();
      void loadProject(route.id);
      return;
    }
    if (route.name === "criativo-skill") {
      const feature = findCreativeFeature(route.id);
      if (feature?.kind === "video") return;
      if (!feature || isPlaygroundFeature(route.id)) {
        navigate({ name: "criativo", kind: "image" }, { replace: true });
        return;
      }
      startBlank();
      nameInput.value = feature.title;
      showView("skill");
      renderSkills(route.id);
      document.title = titleForRoute(route, feature.title);
      return;
    }
    if (
      route.name === "imagens" ||
      (route.name === "criativo" && route.kind === "image")
    ) {
      startBlank();
      showView("playground");
      renderSkills();
    }
  }

  autosizePrompt();
  return { onRoute };
}
