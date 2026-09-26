import "./style.css";
import type { CitySuggestion, Lead, NeighborhoodSuggestion } from "./types";
import { initStudioTheme } from "./theme";
import { api } from "./api";
import { initConfigTab } from "./config-tab";
import { initPackagesTab } from "./packages-tab";
import { initCalendarTab } from "./calendar-tab";
import { initCreativeTab } from "./creative-tab";
import { initPersonagensTab } from "./personagens-tab";
import { initMoviesTab } from "./movies-tab";
import { initInicioFimTab } from "./inicio-fim-tab";
import { initUgcSkillsTab } from "./ugc-skills-tab";
import { initImagensTab } from "./imagens-tab";
import { initImagensStudio } from "./imagens-studio";
import { initCriativoGallery } from "./criativo-gallery";
import { initVideosTab } from "./videos-tab";
import { initVideosStudio } from "./videos-studio";
import { initUsersTab } from "./users-tab";
import { isVideoCreativeSkill } from "./creative/features";
import {
  canAccessCreative,
  canAccessImages,
  canAccessVideos,
  logoutStudio,
  requireStudioSession,
  isStudioAdmin,
  setStudioUser,
  type StudioUser,
} from "./session";
import {
  isCriativoGalleryRoute,
  isImagensStudioRoute,
  isVideosStudioRoute,
  hrefFor,
  navigate,
  navRouteFor,
  startRouter,
  tabForRoute,
  titleForRoute,
  type AppRoute,
} from "./router";
import { entityKindOf, profileApi, type EntityKind } from "./profile-api";
import { initSiteSkillModal } from "./site-skill-modal";
import { initSiteSkillProgress } from "./site-skill-progress";
import { initIgSkillModal } from "./ig-skill-modal";
import { initIgSkillProgress } from "./ig-skill-progress";
import { initIgSkillReport } from "./ig-skill-report";
import { initLeadGallery } from "./lead-gallery";
import { initLeadAccountModal } from "./lead-account-modal";
import { initLeadShareModal } from "./lead-share-modal";
import { initLeadWebsiteModal } from "./lead-website-modal";
import {
  websiteHealthHostsHtml,
  type WebsiteHealth,
} from "./website-health-ui";
import { initLeadEditModal } from "./lead-edit-modal";
import { initLeadFichaModal } from "./lead-ficha-modal";
import { initLeadEmailsModal } from "./lead-emails-modal";
import { initLeadWhatsAppModal } from "./lead-whatsapp-modal";
import { initUiLib } from "./ui-lib/playground";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function formInput(form: HTMLFormElement, name: string): HTMLInputElement {
  const node = form.elements.namedItem(name);
  if (!(node instanceof HTMLInputElement)) {
    throw new Error(`Campo ${name} não encontrado`);
  }
  return node;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const discoveryForm = el<HTMLFormElement>("discovery-form");
const discoveryStatus = el<HTMLElement>("discovery-status");
const discoveryResults = el<HTMLElement>("discovery-results");
const discoveryBtn = el<HTMLButtonElement>("discovery-btn");
const discoveryClearCacheBtn = el<HTMLButtonElement>("discovery-clear-cache-btn");
const discoveryPagination = el<HTMLElement>("discovery-pagination");
const discoveryPageInfo = el<HTMLElement>("discovery-page-info");
const discoveryPageButtons = el<HTMLElement>("discovery-page-buttons");
const DISCOVERY_PAGE_SIZE = 10;
let discoveryItems: Lead[] = [];
let discoveryPage = 1;
/** Saved leads indexed for matching discovery results. */
let savedLeadsByKey = new Map<string, Lead>();

const discoveryCityInput = el<HTMLInputElement>("discovery-city");
const discoveryStateInput = el<HTMLInputElement>("discovery-state");
const discoveryCitySuggestions = el<HTMLElement>("discovery-city-suggestions");
const discoveryNeighborhoodInput = el<HTMLInputElement>(
  "discovery-neighborhood",
);
const discoveryNeighborhoodSuggestions = el<HTMLElement>(
  "discovery-neighborhood-suggestions",
);
const discoveryHideSaved = el<HTMLInputElement>("discovery-hide-saved");
const discoveryCategorySelect = el<HTMLSelectElement>("discovery-category");
const discoveryCategoryCustom = el<HTMLInputElement>("discovery-category-custom");
const discoveryCategoryCustomWrap = el<HTMLElement>(
  "discovery-category-custom-wrap",
);

function syncDiscoveryCategoryCustom() {
  const isCustom = discoveryCategorySelect.value === "__custom__";
  discoveryCategoryCustomWrap.hidden = !isCustom;
  discoveryCategoryCustom.required = isCustom;
  if (!isCustom) {
    discoveryCategoryCustom.value = "";
  } else {
    discoveryCategoryCustom.focus();
  }
}

discoveryCategorySelect.addEventListener("change", syncDiscoveryCategoryCustom);
syncDiscoveryCategoryCustom();

function discoveryCategoryValue(): string {
  if (discoveryCategorySelect.value === "__custom__") {
    return discoveryCategoryCustom.value.trim();
  }
  return discoveryCategorySelect.value.trim();
}

const enrichForm = el<HTMLFormElement>("enrich-form");
const enrichStatus = el<HTMLElement>("enrich-status");
const enrichBtn = el<HTMLButtonElement>("enrich-btn");

const leadDetail = el<HTMLElement>("lead-detail");
const leadContext = el<HTMLElement>("lead-context");
const leadContextSummary = el<HTMLElement>("lead-context-summary");
const leadContextEditBtn = el<HTMLButtonElement>("lead-context-edit-btn");
const leadContextFullBtn = el<HTMLButtonElement>("lead-context-full-btn");
const leadContextActions = el<HTMLElement>("lead-context-actions");
const leadContextHistory = el<HTMLElement>("lead-context-history");
const leadHistoryCard = el<HTMLElement>("lead-history");
const leadHistoryCount = leadHistoryCard.querySelector<HTMLElement>(
  "[data-lead-history-count]",
);
const savedLeads = el<HTMLElement>("saved-leads");
const savedLeadsStatus = el<HTMLElement>("saved-leads-status");
const refreshLeadsBtn = el<HTMLButtonElement>("refresh-leads-btn");
const leadsSearchInput = el<HTMLInputElement>("leads-search-input");
const leadsCategoryFilter = el<HTMLSelectElement>("leads-category-filter");
const leadsOriginFilter = el<HTMLSelectElement>("leads-origin-filter");
const savedCustomers = el<HTMLElement>("saved-customers");
const savedCustomersStatus = el<HTMLElement>("saved-customers-status");
const refreshCustomersBtn = el<HTMLButtonElement>("refresh-customers-btn");
const customersSearchInput = el<HTMLInputElement>("customers-search-input");
const customersCategoryFilter = el<HTMLSelectElement>(
  "customers-category-filter",
);
const navLinks = document.querySelectorAll<HTMLAnchorElement>(
  ".side-nav a[data-route]",
);

initStudioTheme(document.getElementById("studio-theme-btn"));

/** Cache da lista completa para filtrar no client. */
let savedLeadsCache: Lead[] = [];
let leadsSearchDebounce: ReturnType<typeof setTimeout> | null = null;
let savedCustomersCache: Lead[] = [];
let customersSearchDebounce: ReturnType<typeof setTimeout> | null = null;

const detailHeading = el<HTMLElement>("detail-heading");
const leadSitePanel = el<HTMLElement>("lead-site-panel");
const leadQuickActions = el<HTMLElement>("lead-quick-actions");
const siteAddBtn = el<HTMLButtonElement>("site-add-btn");
const siteAgendaBtn = el<HTMLButtonElement>("site-agenda-btn");
const siteSkillBtn = el<HTMLButtonElement>("site-skill-btn");
const igSkillBtn = el<HTMLButtonElement>("ig-skill-btn");
const siteStatus = el<HTMLElement>("site-status");
const siteActions = el<HTMLElement>("site-actions");
const heroHealth = el<HTMLElement>("lead-hero-health");
const heroHealthSummary = el<HTMLElement>("lead-hero-health-summary");
const heroHealthList = el<HTMLElement>("lead-hero-health-list");
const heroHealthRefresh = el<HTMLButtonElement>("lead-hero-health-refresh");

let currentLeadId: string | null = null;
let currentEntityKind: EntityKind = "lead";
let currentLead: Lead | null = null;
let historyLoadSeq = 0;
let heroHealthSeq = 0;
const contextWide = window.matchMedia("(min-width: 1100px)");

function syncLeadContextFold(on = document.body.classList.contains("is-lead-view")) {
  const fold = document.getElementById("lead-context-fold");
  if (fold instanceof HTMLDetailsElement) {
    // Em desktop o summary some (display:contents). Details fechado = coluna vazia.
    fold.open = on && contextWide.matches;
  }
}

function setLeadView(on: boolean) {
  document.body.classList.toggle("is-lead-view", on);
  leadContext.hidden = !on;
  if (!on) heroHealth.hidden = true;
  syncLeadContextFold(on);
}

contextWide.addEventListener("change", () => syncLeadContextFold());

function nameFromImagensStudio(): string | undefined {
  const input = document.getElementById("imagens-project-name");
  if (input instanceof HTMLInputElement && input.value.trim()) {
    return input.value.trim();
  }
  return undefined;
}

function nameFromVideosStudio(): string | undefined {
  const input = document.getElementById("videos-project-name");
  if (input instanceof HTMLInputElement && input.value.trim()) {
    return input.value.trim();
  }
  return undefined;
}

function showTab(tabId: string) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncNav(route: AppRoute) {
  const current = navRouteFor(route);
  navLinks.forEach((link) => {
    const active = link.dataset.route === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const packagesTab = initPackagesTab();
const calendarTab = initCalendarTab();
const creativeTab = initCreativeTab();
const personagensTab = initPersonagensTab();
const moviesTab = initMoviesTab();
const inicioFimTab = initInicioFimTab();
const ugcSkillsTab = initUgcSkillsTab();
const imagensTab = initImagensTab();
const imagensStudio = initImagensStudio();
const criativoGallery = initCriativoGallery();
const videosTab = initVideosTab();
const videosStudio = initVideosStudio();
const usersTab = initUsersTab();
let currentUser: StudioUser | null = null;

function applyRoute(route: AppRoute) {
  document.body.classList.toggle("is-imagens-studio", isImagensStudioRoute(route));
  document.body.classList.toggle("is-videos-studio", isVideosStudioRoute(route));
  document.body.classList.toggle("is-criativo-gallery", isCriativoGalleryRoute(route));
  showTab(tabForRoute(route));
  syncNav(route);
  if (route.name === "lead" || route.name === "customer") {
    const kind = route.name === "customer" ? "customer" : "lead";
    if (currentLeadId !== route.id || currentEntityKind !== kind) {
      void openSavedLead(route.id, kind);
    } else {
      setLeadView(true);
    }
  } else {
    setLeadView(false);
  }
  const titleHint =
    route.name === "lead" || route.name === "customer"
      ? detailHeading.textContent || undefined
      : isImagensStudioRoute(route)
        ? nameFromImagensStudio()
        : isVideosStudioRoute(route)
          ? nameFromVideosStudio()
          : undefined;
  document.title = titleForRoute(route, titleHint);
  if (
    route.name === "criativo" ||
    route.name === "criativo-skill" ||
    route.name === "criativo-gallery"
  ) {
    if (!canAccessCreative(currentUser)) {
      showTab("not-found");
      document.title = titleForRoute({ name: "not-found" });
      document.body.classList.remove(
        "is-imagens-studio",
        "is-videos-studio",
        "is-criativo-gallery",
      );
      return;
    }
    if (route.name === "criativo-skill") {
      const videoSkill = isVideoCreativeSkill(route.id);
      const allowed = videoSkill
        ? canAccessVideos(currentUser)
        : canAccessImages(currentUser);
      if (!allowed) {
        document.body.classList.remove(
          "is-imagens-studio",
          "is-videos-studio",
          "is-criativo-gallery",
        );
        showTab("not-found");
        document.title = titleForRoute({ name: "not-found" });
        return;
      }
    }
    if (route.name === "criativo") {
      if (route.kind === "image" && !canAccessImages(currentUser) && canAccessVideos(currentUser)) {
        navigate({ name: "criativo", kind: "video" }, { replace: true });
        return;
      }
      if (route.kind === "video" && !canAccessVideos(currentUser) && canAccessImages(currentUser)) {
        navigate({ name: "criativo", kind: "image" }, { replace: true });
        return;
      }
    }
  }
  if (route.name === "imagens" || route.name === "imagens-project") {
    if (!canAccessImages(currentUser)) {
      document.body.classList.remove(
        "is-imagens-studio",
        "is-videos-studio",
        "is-criativo-gallery",
      );
      showTab("not-found");
      document.title = titleForRoute({ name: "not-found" });
      return;
    }
  }
  if (route.name === "videos" || route.name === "videos-project") {
    if (!canAccessVideos(currentUser)) {
      document.body.classList.remove(
        "is-imagens-studio",
        "is-videos-studio",
        "is-criativo-gallery",
      );
      showTab("not-found");
      document.title = titleForRoute({ name: "not-found" });
      return;
    }
  }
  if (route.name === "users" || route.name === "user" || route.name === "ui-lib") {
    if (!isStudioAdmin()) {
      showTab("not-found");
      document.title = titleForRoute({ name: "not-found" });
      return;
    }
  }
  packagesTab.onRoute(route);
  calendarTab.onRoute(route);
  creativeTab.onRoute(route);
  imagensTab.onRoute(route);
  imagensStudio.onRoute(route);
  personagensTab.onRoute(route);
  criativoGallery.onRoute(route);
  videosTab.onRoute(route);
  videosStudio.onRoute(route);
  moviesTab.onRoute(route);
  inicioFimTab.onRoute(route);
  ugcSkillsTab.onRoute(route);
  if (route.name === "users" || route.name === "user") {
    usersTab.onRoute(route);
  }
}

initUiLib(el<HTMLElement>("ui-lib-root"));
initConfigTab({ onSaved: () => undefined });
const siteSkillProgress = initSiteSkillProgress();
const siteSkill = initSiteSkillModal(el<HTMLElement>("site-skill-root"), {
  onStarted: (jobId) => siteSkillProgress.watch(jobId),
});
const igSkillReport = initIgSkillReport(el<HTMLElement>("ig-skill-report-root"));
const igSkillProgress = initIgSkillProgress({
  onDone: (job) => {
    if (!currentLeadId || !job.report) return;
    igSkillReport.open(job.report as never, {
      id: currentLeadId,
      kind: currentEntityKind,
    });
  },
});
const igSkill = initIgSkillModal(el<HTMLElement>("ig-skill-root"), {
  onStarted: (jobId) => igSkillProgress.watch(jobId),
  onOpenReport: () => {
    if (!currentLeadId) return;
    void igSkillReport.openLatest({ id: currentLeadId, kind: currentEntityKind });
  },
});
const leadGallery = initLeadGallery(el<HTMLElement>("lead-gallery-root"), {
  onLeadUpdated: (lead) => {
    renderLead(lead);
    loadSavedLeads();
  },
});
initLeadAccountModal(el<HTMLElement>("lead-account-root"));
const leadShare = initLeadShareModal(el<HTMLElement>("lead-share-root"));
const leadWebsite = initLeadWebsiteModal(el<HTMLElement>("lead-website-root"), {
  onLinked: (lead) => {
    renderLead(lead);
    loadSavedLeads();
    loadSavedCustomers();
    const repo = lead.websiteRepo || lead.websiteProjectId;
    setStatus(
      siteStatus,
      repo
        ? `${repo} vinculado. Push em main publica.`
        : "Site vinculado.",
    );
  },
});
const leadEmails = initLeadEmailsModal(el<HTMLElement>("lead-emails-root"), {
  onSent: () => {
    if (currentLead) void loadLeadHistory(currentLead);
  },
});
const leadWhatsApp = initLeadWhatsAppModal(el<HTMLElement>("lead-whatsapp-root"), {
  onSent: () => {
    if (currentLead) void loadLeadHistory(currentLead);
  },
});
const leadEdit = initLeadEditModal(el<HTMLElement>("lead-edit-root"), {
  onSaved: (lead) => {
    renderLead(lead);
    void loadSavedLeads();
  },
});
const leadFicha = initLeadFichaModal(el<HTMLElement>("lead-ficha-root"));

function studioAccessTagsHtml(lead: Lead): string {
  if (isStudioAdmin()) {
    const label =
      lead.createdBy?.name || lead.createdBy?.email || "Sem responsável";
    return `<span class="lead-tag lead-tag-creator">${escapeHtml(label)}</span>`;
  }
  if (lead.sharedWithMe) {
    return `<span class="lead-tag lead-tag-shared">Compartilhado</span>`;
  }
  return "";
}

function hasInstagramConnection(lead: Lead): boolean {
  return Boolean(lead.instagramConnections?.length);
}

function instagramConnectionTagHtml(lead: Lead): string {
  if (!hasInstagramConnection(lead)) return "";
  const username = lead.instagramConnections?.[0]?.username?.replace(/^@/, "");
  const label = username
    ? `Instagram conectado · @${username}`
    : "Instagram conectado";
  return `<span class="lead-tag lead-tag-ig-connected">${escapeHtml(label)}</span>`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

function setStatus(
  node: HTMLElement,
  message: string,
  isError = false,
  isCached = false,
) {
  node.textContent = message || "";
  node.classList.toggle("error", Boolean(isError));
  node.classList.toggle("cached", Boolean(isCached) && !isError);
}

function escapeHtml(text: unknown) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setupCityAutocomplete({
  input,
  stateInput,
  listEl,
  onSelect,
}: {
  input: HTMLInputElement;
  stateInput: HTMLInputElement;
  listEl: HTMLElement;
  onSelect?: () => void;
}) {
  let items: CitySuggestion[] = [];
  let activeIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestId = 0;

  function hide() {
    listEl.hidden = true;
    listEl.innerHTML = "";
    items = [];
    activeIndex = -1;
  }

  function render() {
    if (!items.length) {
      hide();
      return;
    }
    listEl.innerHTML = items
      .map(
        (item, index) => `
      <li role="option" data-index="${index}" aria-selected="${
        index === activeIndex
      }">
        ${escapeHtml(item.label)}
        <span class="suggestion-meta">${escapeHtml(item.name)} · ${escapeHtml(item.state)}</span>
      </li>`,
      )
      .join("");
    listEl.hidden = false;
  }

  function select(index: number) {
    const item = items[index];
    if (!item) return;
    input.value = item.name;
    stateInput.value = item.state;
    hide();
    onSelect?.();
  }

  async function search(term: string) {
    const q = term.trim();
    if (q.length < 2) {
      hide();
      return;
    }
    const id = ++requestId;
    try {
      const res = await api(
        `/locations/cities?q=${encodeURIComponent(q)}&limit=8`,
      );
      const data = await res.json();
      if (id !== requestId) return;
      if (!res.ok) {
        hide();
        return;
      }
      items = Array.isArray(data) ? (data as CitySuggestion[]) : [];
      activeIndex = items.length ? 0 : -1;
      render();
    } catch {
      if (id === requestId) hide();
    }
  }

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(input.value), 220);
  });

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (listEl.hidden || !items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      render();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(activeIndex);
    } else if (event.key === "Escape") {
      hide();
    }
  });

  listEl.addEventListener("mousedown", (event) => {
    const li = (event.target as HTMLElement).closest<HTMLLIElement>(
      "li[data-index]",
    );
    if (!li) return;
    event.preventDefault();
    select(Number(li.dataset.index));
  });

  input.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });
}

setupCityAutocomplete({
  input: discoveryCityInput,
  stateInput: discoveryStateInput,
  listEl: discoveryCitySuggestions,
  onSelect: () => {
    discoveryNeighborhoodInput.value = "";
  },
});

setupCityAutocomplete({
  input: el<HTMLInputElement>("enrich-city"),
  stateInput: el<HTMLInputElement>("enrich-state"),
  listEl: el<HTMLElement>("enrich-city-suggestions"),
});

function setupNeighborhoodAutocomplete({
  input,
  cityInput,
  stateInput,
  listEl,
}: {
  input: HTMLInputElement;
  cityInput: HTMLInputElement;
  stateInput: HTMLInputElement;
  listEl: HTMLElement;
}) {
  let items: NeighborhoodSuggestion[] = [];
  let activeIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestId = 0;

  function hide() {
    listEl.hidden = true;
    listEl.innerHTML = "";
    items = [];
    activeIndex = -1;
  }

  function render() {
    if (!items.length) {
      hide();
      return;
    }
    listEl.innerHTML = items
      .map(
        (item, index) => `
      <li role="option" data-index="${index}" aria-selected="${
        index === activeIndex
      }">
        ${escapeHtml(item.label)}
      </li>`,
      )
      .join("");
    listEl.hidden = false;
  }

  function select(index: number) {
    const item = items[index];
    if (!item) return;
    input.value = item.name;
    hide();
  }

  async function search(term: string) {
    const q = term.trim();
    const city = cityInput.value.trim();
    const state = stateInput.value.trim();
    if (q.length < 2 || !city || !state) {
      hide();
      return;
    }
    const id = ++requestId;
    try {
      const res = await api(
        `/locations/neighborhoods?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&q=${encodeURIComponent(q)}&limit=8`,
      );
      const data = await res.json();
      if (id !== requestId) return;
      if (!res.ok) {
        hide();
        return;
      }
      items = Array.isArray(data) ? (data as NeighborhoodSuggestion[]) : [];
      activeIndex = items.length ? 0 : -1;
      render();
    } catch {
      if (id === requestId) hide();
    }
  }

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(input.value), 220);
  });

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (listEl.hidden || !items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      render();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(activeIndex);
    } else if (event.key === "Escape") {
      hide();
    }
  });

  listEl.addEventListener("mousedown", (event) => {
    const li = (event.target as HTMLElement).closest<HTMLLIElement>(
      "li[data-index]",
    );
    if (!li) return;
    event.preventDefault();
    select(Number(li.dataset.index));
  });

  input.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });
}

setupNeighborhoodAutocomplete({
  input: discoveryNeighborhoodInput,
  cityInput: discoveryCityInput,
  stateInput: discoveryStateInput,
  listEl: discoveryNeighborhoodSuggestions,
});

discoveryCityInput.addEventListener("input", () => {
  discoveryNeighborhoodInput.value = "";
});

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return (
    value !== null && value !== undefined && String(value).trim() !== ""
  );
}

function linkOrText(value: unknown) {
  const text = String(value);
  if (/^https?:\/\//i.test(text) || text.startsWith("www.")) {
    const href = text.startsWith("www.") ? `https://${text}` : text;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  if (text.startsWith("@")) {
    const handle = text.replace(/^@/, "");
    return `<a href="https://www.instagram.com/${escapeHtml(handle)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  if (text.includes("@") && text.includes(".")) {
    return `<a href="mailto:${escapeHtml(text)}">${escapeHtml(text)}</a>`;
  }
  return escapeHtml(text);
}

function fillEnrichForm(lead: Lead) {
  formInput(enrichForm, "name").value = lead.name || "";
  formInput(enrichForm, "city").value = lead.city || formInput(discoveryForm, "city").value || "";
  formInput(enrichForm, "state").value = lead.state || formInput(discoveryForm, "state").value || "";
  formInput(enrichForm, "website").value = lead.website || "";
  formInput(enrichForm, "instagram").value = lead.instagram || "";
  formInput(enrichForm, "phone").value = lead.phone || "";
  navigate({ name: "enrichment" });
}

function contextValue(value: unknown, empty = "—") {
  if (!hasValue(value)) return `<span class="missing">${empty}</span>`;
  const display = Array.isArray(value) ? value.join(", ") : value;
  return linkOrText(display);
}

function renderLeadContext(lead: Lead) {
  const kind = entityKindOf(lead);
  const isCustomer = kind === "customer";
  const imageList = lead.images || [];
  const sources = (lead.sources || []).map((s) => s.provider).filter(Boolean);
  const place =
    lead.city && lead.state
      ? `${lead.city}/${lead.state}`
      : lead.city || lead.state || "";
  const foldSummary = document.querySelector("#lead-context-fold > summary");
  if (foldSummary) {
    foldSummary.textContent = isCustomer
      ? "Contexto do cliente"
      : "Contexto do lead";
  }
  const summaryTitle = leadContextSummary.closest(".app-card")?.querySelector("h3");
  if (summaryTitle) {
    summaryTitle.textContent = isCustomer ? "Resumo do cliente" : "Resumo do lead";
  }
  const backBtn = document.getElementById("detail-back-btn");
  if (backBtn instanceof HTMLAnchorElement) {
    backBtn.href = isCustomer ? "/customers" : "/leads";
    backBtn.textContent = isCustomer
      ? "← Voltar aos clientes"
      : "← Voltar aos leads";
  }
  leadContextEditBtn.hidden = !lead.id;
  leadContextEditBtn.onclick = () => leadEdit.open(lead);
  leadContextFullBtn.hidden = !lead.id;
  leadContextFullBtn.onclick = () => leadFicha.open(lead);
  leadContextSummary.innerHTML = `
    <div><dt>ID</dt><dd><code>${escapeHtml(lead.id || "—")}</code></dd></div>
    <div><dt>Cidade / UF</dt><dd>${contextValue(place)}</dd></div>
    <div><dt>Telefone</dt><dd>${contextValue(lead.phone)}</dd></div>
    <div><dt>E-mail</dt><dd>${contextValue(lead.email)}</dd></div>
    <div><dt>Website</dt><dd>${contextValue(lead.website)}</dd></div>
    <div><dt>Instagram</dt><dd>${contextValue(lead.instagram)}</dd></div>
    <div><dt>Fontes</dt><dd>${contextValue(sources.length ? sources.join(", ") : null)}</dd></div>
    <div><dt>Atualizado</dt><dd>${contextValue(lead.updatedAt ? formatDate(lead.updatedAt) : null)}</dd></div>
    <div id="lead-proposal-status"><dt>Proposta</dt><dd><span class="missing">—</span></dd></div>
  `;

  const previewHref = lead.publishedOrigin
    ? lead.publishedOrigin
    : lead.websiteRepo
      ? `https://github.com/${lead.websiteRepo}`
      : "";
  const canPreview = Boolean(previewHref);
  leadContextActions.innerHTML = `
    ${
      lead.id
        ? `<button type="button" data-context-action="gallery">Galeria${
            imageList.length ? ` (${imageList.length})` : ""
          }</button>`
        : ""
    }
    ${
      canPreview
        ? `<a href="${escapeHtml(previewHref)}" target="_blank" rel="noopener noreferrer">${lead.publishedOrigin ? "Abrir site" : "Abrir repo"}</a>`
        : ""
    }
    ${
      lead.publishedOrigin
        ? `<a href="${escapeHtml(lead.publishedOrigin)}" target="_blank" rel="noopener noreferrer">Site na Vercel</a>`
        : ""
    }
    ${lead.id ? `<button type="button" data-context-action="emails">E-mails</button>` : ""}
    ${lead.id ? `<button type="button" data-context-action="whatsapp">Wpp Msgs</button>` : ""}
    ${lead.id ? `<button type="button" data-context-action="export">Exportar dados</button>` : ""}
    ${
      lead.id && lead.canManageShares
        ? `<button type="button" data-context-action="share">Compartilhar</button>`
        : ""
    }
    ${
      lead.id && !isCustomer
        ? `<button type="button" data-context-action="convert-customer">Transformar em cliente</button>`
        : ""
    }
    ${
      lead.id
        ? `<button type="button" data-context-action="mark-paid" hidden>Marcar como pago</button>`
        : ""
    }
  `;
  leadContextActions
    .querySelector("[data-context-action='gallery']")
    ?.addEventListener("click", () => leadGallery.open(lead));
  leadContextActions
    .querySelector("[data-context-action='emails']")
    ?.addEventListener("click", () => {
      if (lead.id) leadEmails.open(lead.id, kind);
    });
  leadContextActions
    .querySelector("[data-context-action='whatsapp']")
    ?.addEventListener("click", () => {
      if (lead.id) leadWhatsApp.open(lead.id, kind);
    });
  leadContextActions
    .querySelector("[data-context-action='export']")
    ?.addEventListener("click", () => exportLeadJson(lead));
  leadContextActions
    .querySelector("[data-context-action='share']")
    ?.addEventListener("click", () => {
      if (lead.id) leadShare.open(lead.id, kind);
    });
  leadContextActions
    .querySelector("[data-context-action='convert-customer']")
    ?.addEventListener("click", () => {
      if (lead.id) void convertLeadToCustomer(lead);
    });
  leadContextActions
    .querySelector("[data-context-action='mark-paid']")
    ?.addEventListener("click", () => {
      if (lead.id) void markProposalPaid(lead);
    });

  void loadLeadHistory(lead);
  void loadLeadProposal(lead);
}

type HistoryItem = {
  title: string;
  summary?: string | null;
  at?: string;
  atLabel?: string;
  kind?: string;
  channel?: string;
  payload?: Record<string, unknown> | null;
};

function historyChannelLabel(channel?: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    skill: "Skill",
    email: "E-mail",
    whatsapp: "WhatsApp",
    calendar: "Agenda",
    account: "Conta",
    invite: "Convite",
    enrichment: "Dados",
    media: "Mídia",
    studio: "Studio",
    system: "Sistema",
    chat: "Chat",
  };
  return labels[channel || ""] || channel || "Evento";
}

function renderHistoryItems(items: HistoryItem[]) {
  if (leadHistoryCount) {
    leadHistoryCount.textContent = items.length
      ? `${items.length} evento${items.length === 1 ? "" : "s"}`
      : "";
  }
  leadContextHistory.innerHTML = items.length
    ? items
        .map((item) => {
          const payload = item.payload
            ? JSON.stringify(item.payload, null, 2)
            : "";
          return `<li class="lead-history__item" data-channel="${escapeHtml(item.channel || "system")}">
            <span class="lead-history__channel">${escapeHtml(historyChannelLabel(item.channel))}</span>
            <div class="lead-history__body">
              <strong>${escapeHtml(item.title)}</strong>
              ${
                item.summary
                  ? `<p class="meta">${escapeHtml(item.summary)}</p>`
                  : ""
              }
              ${
                item.atLabel || item.at
                  ? `<p class="meta">${escapeHtml(item.atLabel || item.at || "")}</p>`
                  : ""
              }
              ${
                item.kind
                  ? `<p class="lead-history__kind"><code>${escapeHtml(item.kind)}</code></p>`
                  : ""
              }
              ${
                payload
                  ? `<details class="lead-history__payload"><summary>payload</summary><pre>${escapeHtml(payload)}</pre></details>`
                  : ""
              }
            </div>
          </li>`;
        })
        .join("")
    : `<li class="lead-history__empty">Sem histórico</li>`;
}

function fallbackHistory(lead: Lead): HistoryItem[] {
  const history: HistoryItem[] = [];
  if (lead.createdAt) {
    history.push({
      title: entityKindOf(lead) === "customer" ? "Cliente criado" : "Lead criado",
      at: lead.createdAt,
      atLabel: formatDate(lead.createdAt),
      kind: entityKindOf(lead) === "customer" ? "customer.created" : "lead.created",
      channel: "system",
    });
  }
  return history;
}

async function loadLeadProposal(lead: Lead) {
  const row = document.getElementById("lead-proposal-status");
  const markPaidBtn = leadContextActions.querySelector(
    "[data-context-action='mark-paid']",
  ) as HTMLButtonElement | null;
  if (!lead.id || !row) {
    if (markPaidBtn) markPaidBtn.hidden = true;
    return;
  }
  try {
    const res = await api(profileApi(entityKindOf(lead), lead.id, "/proposal"));
    const data = (await res.json().catch(() => ({}))) as {
      proposal?: {
        status?: string;
        paymentStatus?: string;
        package?: { name?: string };
      } | null;
    };
    if (!res.ok || !data.proposal) {
      row.innerHTML = `<dt>Proposta</dt><dd><span class="missing">não enviada</span></dd>`;
      if (markPaidBtn) markPaidBtn.hidden = true;
      return;
    }
    const status =
      data.proposal.status === "accepted" ? "aceita" : "pendente";
    const payment =
      data.proposal.paymentStatus === "paid"
        ? "pago"
        : data.proposal.paymentStatus === "waived"
          ? "sem cobrança"
          : "pagamento pendente";
    const pkg = data.proposal.package?.name
      ? ` · ${data.proposal.package.name}`
      : "";
    row.innerHTML = `<dt>Proposta</dt><dd>${escapeHtml(`${status} · ${payment}${pkg}`)}</dd>`;
    if (markPaidBtn) {
      markPaidBtn.hidden = data.proposal.paymentStatus !== "pending";
    }
  } catch {
    row.innerHTML = `<dt>Proposta</dt><dd><span class="missing">—</span></dd>`;
    if (markPaidBtn) markPaidBtn.hidden = true;
  }
}

async function markProposalPaid(lead: Lead) {
  if (!lead.id) return;
  if (!confirm(`Marcar o pagamento de ${lead.name || "este perfil"} como pago?`)) {
    return;
  }
  try {
    const res = await api(
      profileApi(entityKindOf(lead), lead.id, "/proposal/mark-paid"),
      { method: "POST" },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || "Falha ao marcar pagamento");
    }
    void loadLeadProposal(lead);
    void loadLeadHistory(lead);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Falha ao marcar pagamento");
  }
}

async function loadLeadHistory(lead: Lead) {
  const seq = ++historyLoadSeq;
  if (!lead.id) {
    renderHistoryItems(fallbackHistory(lead));
    return;
  }
  leadContextHistory.innerHTML = `<li><strong>Carregando histórico…</strong></li>`;
  try {
    const res = await api(
      profileApi(entityKindOf(lead), lead.id, "/history"),
    );
    const data = (await res.json().catch(() => ({}))) as {
      items?: Array<{
        title?: string;
        summary?: string | null;
        at?: string;
        kind?: string;
        channel?: string;
        payload?: Record<string, unknown> | null;
      }>;
    };
    if (seq !== historyLoadSeq) return;
    if (!res.ok || !Array.isArray(data.items)) {
      renderHistoryItems(fallbackHistory(lead));
      return;
    }
    renderHistoryItems(
      data.items.map((item) => ({
        title: item.title || "Evento",
        summary: item.summary,
        at: item.at,
        atLabel: item.at ? formatDate(item.at) : undefined,
        kind: item.kind,
        channel: item.channel,
        payload: item.payload ?? null,
      })),
    );
  } catch {
    if (seq !== historyLoadSeq) return;
    renderHistoryItems(fallbackHistory(lead));
  }
}

function exportLeadJson(lead: Lead) {
  const blob = new Blob([JSON.stringify(lead, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${lead.id || entityKindOf(lead)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderLead(lead: Lead) {
  lead._entityKind = lead._entityKind || currentEntityKind;
  const imageList = lead.images || [];
  const sources = (lead.sources || [])
    .map((s) => s.provider)
    .filter(Boolean);
  const place =
    lead.city && lead.state
      ? `${lead.city}/${lead.state}`
      : lead.city || lead.state || "";
  const igConnected = hasInstagramConnection(lead);
  const tags = [
    imageList.length ? `${imageList.length} imagens` : null,
    ...sources
      .slice(0, 4)
      .filter(
        (source) =>
          !(igConnected && String(source).toLowerCase() === "instagram"),
      ),
    lead.category,
  ].filter(Boolean) as string[];
  const heroPrefixTags =
    studioAccessTagsHtml(lead) + instagramConnectionTagHtml(lead);

  leadDetail.innerHTML = `
    <div class="lead-summary">
      <div class="lead-summary-main">
        <p class="lead-summary-title">
          <strong>${escapeHtml(lead.name || "Sem nome")}</strong>
          <span class="lead-badge">${
            entityKindOf(lead) === "customer"
              ? "Cliente"
              : "Lead atualizado"
          }</span>
        </p>
        <p class="lead-summary-bits">
          ${place ? `<span>${escapeHtml(place)}</span>` : ""}
          ${lead.phone ? `<span>${escapeHtml(lead.phone)}</span>` : ""}
          ${lead.website ? `<span>${linkOrText(lead.website)}</span>` : ""}
        </p>
        ${
          tags.length || heroPrefixTags
            ? `<div class="lead-tags lead-hero-tags">${heroPrefixTags}${tags
                .map((tag) => `<span class="lead-tag">${escapeHtml(tag)}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
      <div class="actions" id="detail-actions"></div>
    </div>
    <div class="status" id="detail-status"></div>
  `;
  const detailActions = document.getElementById("detail-actions");
  if (detailActions && lead.id && entityKindOf(lead) !== "customer") {
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "outline detail-refresh-btn";
    refreshBtn.textContent = "buscar dados novamente";
    refreshBtn.addEventListener("click", () => void reenrichLead(lead.id!, refreshBtn));
    detailActions.appendChild(refreshBtn);
  }

  const nextId = lead.id ?? null;
  if (currentLeadId && nextId && currentLeadId !== nextId) {
    setStatus(siteStatus, "");
  }
  currentLeadId = nextId;
  currentLead = lead;
  currentEntityKind = entityKindOf(lead);
  detailHeading.textContent = lead.name || (currentEntityKind === "customer" ? "Cliente" : "Lead");
  leadSitePanel.hidden = !currentLeadId;
  leadQuickActions.hidden = !currentLeadId;
  leadHistoryCard.hidden = !currentLeadId;
  siteActions.hidden = !currentLeadId;
  setSiteActionsEnabled(Boolean(currentLeadId));
  updateLandingMeta();
  void loadHeroHealth(lead);
  renderLeadContext(lead);
  setLeadView(Boolean(currentLeadId));
  if (currentLeadId) {
    const routeName = currentEntityKind === "customer" ? "customer" : "lead";
    document.title = titleForRoute(
      { name: routeName, id: currentLeadId },
      lead.name,
    );
    navigate({ name: routeName, id: currentLeadId });
  } else {
    showTab("detail");
  }
  leadGallery.sync(lead);
  leadFicha.sync(lead);
}

async function reenrichLead(id: string, button: HTMLButtonElement) {
  const detailStatus = document.getElementById("detail-status");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Enriquecendo...";
  if (detailStatus) {
    detailStatus.textContent =
      "Reprocessando o lead (busca do site, crawl e redes)...";
  }

  try {
    const res = await api(`/enrichment/${encodeURIComponent(id)}/refresh`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Falha ao enriquecer novamente");
    }
    renderLead(data as Lead);
    const status = document.getElementById("detail-status");
    if (status) status.textContent = "Lead atualizado.";
    loadSavedLeads();
  } catch (error) {
    button.disabled = false;
    button.textContent = originalLabel;
    if (detailStatus) {
      detailStatus.textContent = `Erro: ${(error as Error).message}`;
    }
  }
}

async function loadSavedLeads() {
  setStatus(savedLeadsStatus, "Carregando...");
  refreshLeadsBtn.disabled = true;
  try {
    const res = await api("/leads");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Falha ao listar leads");
    }

    savedLeadsCache = data as Lead[];
    indexSavedLeads(savedLeadsCache);
    populateCategoryFilter(savedLeadsCache);
    renderSavedLeadsList();
  } catch (error) {
    savedLeadsCache = [];
    savedLeads.innerHTML = "";
    setStatus(
      savedLeadsStatus,
      errorMessage(error, "Erro ao carregar leads"),
      true,
    );
  } finally {
    refreshLeadsBtn.disabled = false;
    if (discoveryItems.length) {
      renderDiscoveryPage(discoveryPage);
    }
  }
}

async function loadSavedCustomers() {
  setStatus(savedCustomersStatus, "Carregando...");
  refreshCustomersBtn.disabled = true;
  try {
    const res = await api("/customers");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Falha ao listar clientes");
    }
    savedCustomersCache = (data as Lead[]).map((item) => ({
      ...item,
      _entityKind: "customer" as const,
    }));
    populateNamedCategoryFilter(customersCategoryFilter, savedCustomersCache);
    renderSavedCustomersList();
  } catch (error) {
    savedCustomersCache = [];
    savedCustomers.innerHTML = "";
    setStatus(
      savedCustomersStatus,
      errorMessage(error, "Erro ao carregar clientes"),
      true,
    );
  } finally {
    refreshCustomersBtn.disabled = false;
  }
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function populateNamedCategoryFilter(
  select: HTMLSelectElement,
  leads: Lead[],
) {
  const selected = select.value;
  const categories = [
    ...new Set(
      leads
        .map((lead) => String(lead.category || "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = `<option value="">Todas</option>`;
  if (leads.some((lead) => !String(lead.category || "").trim())) {
    const opt = document.createElement("option");
    opt.value = "__none__";
    opt.textContent = "Sem categoria";
    select.appendChild(opt);
  }
  for (const category of categories) {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    select.appendChild(opt);
  }
  const stillValid = [...select.options].some((opt) => opt.value === selected);
  select.value = stillValid ? selected : "";
}

function populateCategoryFilter(leads: Lead[]) {
  populateNamedCategoryFilter(leadsCategoryFilter, leads);
}

function filterSavedLeads(leads: Lead[]) {
  const query = normalizeSearch(leadsSearchInput.value);
  const category = leadsCategoryFilter.value;
  const origin = leadsOriginFilter.value;

  return leads.filter((lead) => {
    if (origin === "signup" && !lead.fromPublicSignup) return false;
    if (origin === "discovery" && lead.fromPublicSignup) return false;

    if (category === "__none__") {
      if (String(lead.category || "").trim()) return false;
    } else if (category && String(lead.category || "").trim() !== category) {
      return false;
    }

    if (!query) return true;
    const haystack = normalizeSearch(
      [lead.name, lead.city, lead.state, lead.website].filter(Boolean).join(" "),
    );
    return haystack.includes(query);
  });
}

function renderSavedLeadsList() {
  const leads = filterSavedLeads(savedLeadsCache);
  savedLeads.innerHTML = "";

  if (!savedLeadsCache.length) {
    setStatus(savedLeadsStatus, "Nenhum lead enriquecido ainda.");
    return;
  }

  const filtering =
    Boolean(leadsSearchInput.value.trim()) ||
    Boolean(leadsCategoryFilter.value) ||
    Boolean(leadsOriginFilter.value);
  setStatus(
    savedLeadsStatus,
    filtering
      ? `${leads.length} de ${savedLeadsCache.length} lead(s).`
      : `${savedLeadsCache.length} lead(s) salvo(s) no banco.`,
  );

  if (!leads.length) {
    const empty = document.createElement("li");
    empty.className = "empty-filter";
    empty.textContent = "Nenhum lead corresponde aos filtros.";
    savedLeads.appendChild(empty);
    return;
  }

  leads.forEach((lead) => {
    const li = document.createElement("li");
    const place = [lead.city, lead.state].filter(Boolean).join(" - ");
    const counts = lead._count || {};
    const category = String(lead.category || "").trim();
    li.innerHTML = `
      <strong>${escapeHtml(lead.name || "Sem nome")}</strong>
      ${landingBadgeHtml(lead)}
      ${lead.fromPublicSignup ? `<span class="landing-badge origin-badge">cadastro</span>` : ""}
      ${studioAccessTagsHtml(lead)}
      <div class="meta">
        ${category ? `<span class="lead-category-tag">${escapeHtml(category)}</span> · ` : ""}
        ${place ? escapeHtml(place) + " · " : ""}
        atualizado ${escapeHtml(formatDate(lead.updatedAt))}
      </div>
      <div class="meta">
        ${lead.website ? escapeHtml(lead.website) + " · " : ""}
        ${lead.instagram ? escapeHtml(lead.instagram) + " · " : ""}
        ${lead.phone ? escapeHtml(lead.phone) + " · " : ""}
        ${counts.images ?? 0} imagem(ns) · ${counts.sources ?? 0} fonte(s)
        ${lead.landingSlug ? ` · ${escapeHtml(lead.landingSlug)}` : ""}
      </div>
      <div class="actions"></div>
    `;
    const actions = li.querySelector(".actions");
    if (lead.id) {
      const openLink = document.createElement("a");
      openLink.href = hrefFor({ name: "lead", id: lead.id });
      openLink.className = "button-link secondary";
      openLink.textContent = "Abrir";
      actions?.appendChild(openLink);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Deletar";
    deleteBtn.addEventListener("click", () => {
      if (lead.id) void deleteSavedLead(lead.id, lead.name || "este lead");
    });
    actions?.appendChild(deleteBtn);
    savedLeads.appendChild(li);
  });
}

leadsSearchInput.addEventListener("input", () => {
  if (leadsSearchDebounce) clearTimeout(leadsSearchDebounce);
  leadsSearchDebounce = setTimeout(() => renderSavedLeadsList(), 160);
});

leadsCategoryFilter.addEventListener("change", () => {
  renderSavedLeadsList();
});

leadsOriginFilter.addEventListener("change", () => {
  renderSavedLeadsList();
});

function filterSavedCustomers(leads: Lead[]) {
  const query = normalizeSearch(customersSearchInput.value);
  const category = customersCategoryFilter.value;
  return leads.filter((lead) => {
    if (category === "__none__") {
      if (String(lead.category || "").trim()) return false;
    } else if (category && String(lead.category || "").trim() !== category) {
      return false;
    }
    if (!query) return true;
    const haystack = normalizeSearch(
      [lead.name, lead.city, lead.state, lead.website].filter(Boolean).join(" "),
    );
    return haystack.includes(query);
  });
}

function renderSavedCustomersList() {
  const leads = filterSavedCustomers(savedCustomersCache);
  savedCustomers.innerHTML = "";

  if (!savedCustomersCache.length) {
    setStatus(savedCustomersStatus, "Nenhum cliente ainda.");
    return;
  }

  const filtering =
    Boolean(customersSearchInput.value.trim()) ||
    Boolean(customersCategoryFilter.value);
  setStatus(
    savedCustomersStatus,
    filtering
      ? `${leads.length} de ${savedCustomersCache.length} cliente(s).`
      : `${savedCustomersCache.length} cliente(s) no banco.`,
  );

  if (!leads.length) {
    const empty = document.createElement("li");
    empty.className = "empty-filter";
    empty.textContent = "Nenhum cliente corresponde aos filtros.";
    savedCustomers.appendChild(empty);
    return;
  }

  leads.forEach((lead) => {
    const li = document.createElement("li");
    const place = [lead.city, lead.state].filter(Boolean).join(" - ");
    const counts = lead._count || {};
    const category = String(lead.category || "").trim();
    li.innerHTML = `
      <strong>${escapeHtml(lead.name || "Sem nome")}</strong>
      ${landingBadgeHtml(lead)}
      ${studioAccessTagsHtml(lead)}
      <div class="meta">
        ${category ? `<span class="lead-category-tag">${escapeHtml(category)}</span> · ` : ""}
        ${place ? escapeHtml(place) + " · " : ""}
        atualizado ${escapeHtml(formatDate(lead.updatedAt))}
      </div>
      <div class="meta">
        ${lead.website ? escapeHtml(lead.website) + " · " : ""}
        ${lead.instagram ? escapeHtml(lead.instagram) + " · " : ""}
        ${lead.phone ? escapeHtml(lead.phone) + " · " : ""}
        ${counts.images ?? 0} imagem(ns) · ${counts.sources ?? 0} fonte(s)
        ${lead.landingSlug ? ` · ${escapeHtml(lead.landingSlug)}` : ""}
      </div>
      <div class="actions"></div>
    `;
    const actions = li.querySelector(".actions");
    if (lead.id) {
      const openLink = document.createElement("a");
      openLink.href = hrefFor({ name: "customer", id: lead.id });
      openLink.className = "button-link secondary";
      openLink.textContent = "Abrir";
      actions?.appendChild(openLink);
    }
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Deletar";
    deleteBtn.addEventListener("click", () => {
      if (lead.id) void deleteSavedCustomer(lead.id, lead.name || "este cliente");
    });
    actions?.appendChild(deleteBtn);
    savedCustomers.appendChild(li);
  });
}

customersSearchInput.addEventListener("input", () => {
  if (customersSearchDebounce) clearTimeout(customersSearchDebounce);
  customersSearchDebounce = setTimeout(() => renderSavedCustomersList(), 160);
});

customersCategoryFilter.addEventListener("change", () => {
  renderSavedCustomersList();
});

async function deleteSavedCustomer(id: string, name: string) {
  const confirmed = window.confirm(
    `Deletar o cliente "${name}"? Isso remove o registro e as imagens do storage.`,
  );
  if (!confirmed) return;
  setStatus(savedCustomersStatus, `Deletando "${name}"...`);
  try {
    const res = await api(`/customers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { message?: string }).message || "Falha ao deletar cliente",
      );
    }
    setStatus(savedCustomersStatus, `Cliente "${name}" deletado.`);
    if (currentLeadId === id && currentEntityKind === "customer") {
      currentLeadId = null;
      currentLead = null;
      navigate({ name: "customers" });
    }
    await loadSavedCustomers();
  } catch (error) {
    setStatus(
      savedCustomersStatus,
      errorMessage(error, "Erro ao deletar cliente"),
      true,
    );
  }
}


async function deleteSavedLead(id: string, name: string) {
  const confirmed = window.confirm(
    `Deletar o lead "${name}"? Isso remove o registro e as imagens do storage.`,
  );
  if (!confirmed) return;

  setStatus(savedLeadsStatus, `Deletando "${name}"...`);
  try {
    const res = await api(`/leads/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { message?: string }).message || "Falha ao deletar lead",
      );
    }
    setStatus(savedLeadsStatus, `Lead "${name}" deletado.`);
    if (currentLeadId === id) {
      currentLeadId = null;
      currentLead = null;
      navigate({ name: "leads" });
    }
    await loadSavedLeads();
  } catch (error) {
    setStatus(
      savedLeadsStatus,
      errorMessage(error, "Erro ao deletar lead"),
      true,
    );
  }
}

let openLeadRequest = 0;

async function convertLeadToCustomer(lead: Lead) {
  if (!lead.id) return;
  const confirmed = window.confirm(
    `Transformar "${lead.name || "este lead"}" em cliente? O lead será excluído e passará a ser um cliente.`,
  );
  if (!confirmed) return;
  try {
    const res = await api(
      `/leads/${encodeURIComponent(lead.id)}/convert-to-customer`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { message?: string }).message ||
          "Falha ao transformar em cliente",
      );
    }
    const customer = {
      ...(data as Lead),
      _entityKind: "customer" as const,
    };
    await loadSavedLeads();
    await loadSavedCustomers();
    renderLead(customer);
  } catch (error) {
    window.alert(errorMessage(error, "Falha ao transformar em cliente"));
  }
}

async function openSavedLead(id: string, kind: EntityKind = "lead") {
  const request = ++openLeadRequest;
  currentEntityKind = kind;
  const statusEl = kind === "customer" ? savedCustomersStatus : savedLeadsStatus;
  setStatus(statusEl, kind === "customer" ? "Abrindo cliente..." : "Abrindo lead...");
  try {
    const res = await api(profileApi(kind, id));
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.message ||
          (kind === "customer" ? "Cliente não encontrado" : "Lead não encontrado"),
      );
    }
    if (request !== openLeadRequest) return;
    setStatus(statusEl, "");
    renderLead({ ...(data as Lead), _entityKind: kind });
  } catch (error) {
    if (request !== openLeadRequest) return;
    currentLeadId = id;
    currentLead = null;
    currentEntityKind = kind;
    leadSitePanel.hidden = true;
    leadQuickActions.hidden = true;
    leadHistoryCard.hidden = true;
    siteActions.hidden = true;
    setSiteActionsEnabled(false);
    const label = kind === "customer" ? "Cliente" : "Lead";
    detailHeading.textContent = `${label} não encontrado`;
    leadDetail.innerHTML = `<p class="empty-detail">${escapeHtml(
      errorMessage(error, `Erro ao abrir ${label.toLowerCase()}`),
    )}</p>`;
    leadContextFullBtn.hidden = true;
    document.title = titleForRoute(
      { name: kind, id },
      `${label} não encontrado`,
    );
    setStatus(
      statusEl,
      errorMessage(error, `Erro ao abrir ${label.toLowerCase()}`),
      true,
    );
  }
}

function normalizeLeadKey(name: unknown, city?: unknown): string {
  const base = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cityPart = String(city || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cityPart ? `${base}|${cityPart}` : base;
}

function indexSavedLeads(leads: Lead[]) {
  const map = new Map<string, Lead>();
  for (const lead of leads) {
    if (!lead.name) continue;
    const byName = normalizeLeadKey(lead.name);
    const byNameCity = normalizeLeadKey(lead.name, lead.city);
    if (byName && !map.has(byName)) map.set(byName, lead);
    if (byNameCity) map.set(byNameCity, lead);
    if (lead.website) {
      try {
        const host = new URL(
          lead.website.startsWith("http")
            ? lead.website
            : `https://${lead.website}`,
        ).hostname.replace(/^www\./, "").toLowerCase();
        if (host) map.set(`site:${host}`, lead);
      } catch {
        // ignore
      }
    }
  }
  savedLeadsByKey = map;
}

function findSavedMatch(lead: Lead): Lead | null {
  if (lead.website) {
    try {
      const host = new URL(
        lead.website.startsWith("http")
          ? lead.website
          : `https://${lead.website}`,
      ).hostname.replace(/^www\./, "").toLowerCase();
      const bySite = savedLeadsByKey.get(`site:${host}`);
      if (bySite) return bySite;
    } catch {
      // ignore
    }
  }
  const byNameCity = savedLeadsByKey.get(
    normalizeLeadKey(lead.name, lead.city),
  );
  if (byNameCity) return byNameCity;
  return savedLeadsByKey.get(normalizeLeadKey(lead.name)) ?? null;
}

function savedLeadTagsHtml(saved: Lead): string {
  const tags: string[] = ['<span class="lead-tag lead-tag-saved">Lead salvo</span>'];
  if (saved.website) tags.push('<span class="lead-tag">Site</span>');
  if (saved.phone) tags.push('<span class="lead-tag">Telefone</span>');
  if (saved.whatsapp) tags.push('<span class="lead-tag">WhatsApp</span>');
  if (saved.email) tags.push('<span class="lead-tag">E-mail</span>');
  if (saved.instagram) tags.push('<span class="lead-tag">Instagram</span>');
  const images = saved._count?.images ?? saved.images?.length ?? 0;
  if (images > 0) {
    tags.push(`<span class="lead-tag">${images} img</span>`);
  }
  return `<div class="lead-tags">${tags.join("")}</div>`;
}

function discoveryScore(lead: Lead): number {
  let score = 0;
  if (lead.website) score += 3;
  if (lead.phone) score += 2;
  if (lead.rating != null) score += 1;
  if (lead.rating != null && lead.rating >= 4) score += 2;
  if (lead.instagram) score += 1;
  return score;
}

function discoveryOriginSources(lead: Lead): string[] {
  if (lead.discoverySources?.length) return lead.discoverySources;
  if (lead.source) return [lead.source];
  return [];
}

function discoveryOriginLabel(lead: Lead): string {
  const src = discoveryOriginSources(lead);
  const hasGoogle = src.includes("google");
  const hasOsm = src.includes("search");
  if (hasGoogle && hasOsm) return "Google + OSM";
  if (hasGoogle) return "Google";
  if (hasOsm) return "OSM";
  return "";
}

function asDiscoveryLead(
  item: Lead & { sources?: unknown },
): Lead {
  const raw = item.sources;
  const discoverySources =
    Array.isArray(raw) && raw.every((value) => typeof value === "string")
      ? (raw as string[])
      : item.source
        ? [item.source]
        : [];
  return {
    ...item,
    discoverySources,
    source: item.source || discoverySources[0],
  };
}

function filteredDiscoveryItems(): Lead[] {
  const hideSaved = discoveryHideSaved.checked;
  const items = discoveryItems.filter((lead) => {
    if (hideSaved && findSavedMatch(lead)) return false;
    return true;
  });
  return items.sort((a, b) => {
    const scoreDiff = discoveryScore(b) - discoveryScore(a);
    if (scoreDiff) return scoreDiff;
    const ratingDiff = (b.rating ?? -1) - (a.rating ?? -1);
    if (ratingDiff) return ratingDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

function discoveryContactTagsHtml(lead: Lead): string {
  const tags: string[] = [];
  const origin = discoveryOriginLabel(lead);
  if (origin) {
    tags.push(
      `<span class="lead-tag lead-tag-source">${escapeHtml(origin)}</span>`,
    );
  }
  if (lead.website) tags.push('<span class="lead-tag">Site</span>');
  if (lead.phone) tags.push('<span class="lead-tag">Telefone</span>');
  if (lead.instagram) tags.push('<span class="lead-tag">Instagram</span>');
  if (!tags.length) return "";
  return `<div class="lead-tags">${tags.join("")}</div>`;
}

function renderDiscoveryPage(page: number) {
  const items = filteredDiscoveryItems();
  discoveryPage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.length / DISCOVERY_PAGE_SIZE) || 1));
  discoveryResults.innerHTML = "";

  const start = (discoveryPage - 1) * DISCOVERY_PAGE_SIZE;
  const pageItems = items.slice(start, start + DISCOVERY_PAGE_SIZE);

  pageItems.forEach((lead) => {
    const li = document.createElement("li");
    const saved = findSavedMatch(lead);
    const category = lead.category
      ? `<div class="meta">${escapeHtml(lead.category)}</div>`
      : "";
    li.innerHTML = `
      <strong>${escapeHtml(lead.name || "Sem nome")}</strong>
      ${saved ? savedLeadTagsHtml(saved) : ""}
      ${discoveryContactTagsHtml(lead)}
      ${category}
      <div class="meta">${escapeHtml(lead.address || "")}</div>
      <div class="meta">
        ${lead.website ? escapeHtml(lead.website) + " · " : ""}
        ${lead.phone ? escapeHtml(lead.phone) + " · " : ""}
        ${lead.rating != null ? "★ " + lead.rating : ""}
      </div>
      <div class="actions"></div>
    `;
    const actions = li.querySelector(".actions");
    if (saved?.id) {
      const openLink = document.createElement("a");
      openLink.href = hrefFor({ name: "lead", id: saved.id });
      openLink.className = "button-link";
      openLink.textContent = "Abrir lead";
      actions?.appendChild(openLink);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Enriquecer Lead";
    btn.addEventListener("click", () => fillEnrichForm(lead));
    actions?.appendChild(btn);
    discoveryResults.appendChild(li);
  });

  const totalPages = Math.max(1, Math.ceil(items.length / DISCOVERY_PAGE_SIZE));
  const from = items.length ? start + 1 : 0;
  const to = Math.min(start + DISCOVERY_PAGE_SIZE, items.length);
  discoveryPageInfo.textContent = items.length
    ? `${from}–${to} de ${items.length}`
    : "";

  discoveryPageButtons.innerHTML = "";
  if (items.length > DISCOVERY_PAGE_SIZE) {
    discoveryPagination.classList.add("visible");
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "Anterior";
    prev.disabled = discoveryPage === 1;
    prev.addEventListener("click", () => renderDiscoveryPage(discoveryPage - 1));
    discoveryPageButtons.appendChild(prev);

    for (let i = 1; i <= totalPages; i += 1) {
      const pageBtn = document.createElement("button");
      pageBtn.type = "button";
      pageBtn.textContent = String(i);
      pageBtn.className = i === discoveryPage ? "active" : "";
      pageBtn.setAttribute("aria-current", i === discoveryPage ? "page" : "false");
      pageBtn.addEventListener("click", () => renderDiscoveryPage(i));
      discoveryPageButtons.appendChild(pageBtn);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Próxima";
    next.disabled = discoveryPage === totalPages;
    next.addEventListener("click", () => renderDiscoveryPage(discoveryPage + 1));
    discoveryPageButtons.appendChild(next);
  } else {
    discoveryPagination.classList.remove("visible");
  }

  discoveryResults.scrollIntoView({ behavior: "smooth", block: "start" });
}

discoveryForm.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  discoveryResults.innerHTML = "";
  discoveryPagination.classList.remove("visible");
  setStatus(discoveryStatus, "Buscando...");
  discoveryBtn.disabled = true;

  // Refresh saved-lead index so tags stay accurate.
  try {
    const savedRes = await api("/leads");
    if (savedRes.ok) {
      indexSavedLeads((await savedRes.json()) as Lead[]);
    }
  } catch {
    // discovery still works without the index
  }

  const limitRaw = formInput(discoveryForm, "limit").value.trim();
  const limit = Number(limitRaw);
  const radiusRaw = formInput(discoveryForm, "radiusKm").value.trim();
  const radiusKm = Number(radiusRaw);
  const payload: Record<string, string | number> = {
    city: formInput(discoveryForm, "city").value.trim(),
    state: formInput(discoveryForm, "state").value.trim(),
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 500) : 100,
  };
  if (radiusRaw && Number.isFinite(radiusKm)) {
    payload.radiusKm = Math.min(Math.max(radiusKm, 0.5), 30);
  }
  const category = discoveryCategoryValue();
  if (category) payload.category = category;
  const neighborhood = formInput(discoveryForm, "neighborhood").value.trim();
  if (neighborhood) payload.neighborhood = neighborhood;

  try {
    const res = await api("/lead-discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Falha no discovery");
    }

    discoveryItems = ((data.results || []) as Array<Lead & { sources?: unknown }>).map(
      asDiscoveryLead,
    );
    const fromCache = Boolean(data.cached);
    const geo = data.geo as
      | {
          mode?: string;
          fallback?: boolean;
          neighborhood?: string;
          radiusKm?: number;
        }
      | undefined;
    const geoNote = geo?.fallback
      ? ` Bairro não encontrado; usando raio de ${geo.radiusKm ?? payload.radiusKm} km.`
      : geo?.mode === "neighborhood" && geo.neighborhood
        ? ` Recorte: ${geo.neighborhood}.`
        : geo?.mode === "radius"
          ? ` Recorte: raio de ${geo.radiusKm ?? payload.radiusKm} km.`
          : "";
    setStatus(
      discoveryStatus,
      discoveryItems.length
        ? fromCache
          ? `${discoveryItems.length} lead(s) encontrado(s) (do cache).${geoNote}`
          : `${discoveryItems.length} lead(s) encontrado(s).${geoNote}`
        : fromCache
          ? `Nenhum resultado (do cache).${geoNote}`
          : `Nenhum resultado.${geoNote}`,
      false,
      fromCache,
    );
    renderDiscoveryPage(1);
  } catch (error) {
    discoveryItems = [];
    setStatus(discoveryStatus, errorMessage(error, "Erro no discovery"), true);
  } finally {
    discoveryBtn.disabled = false;
  }
});

discoveryClearCacheBtn.addEventListener("click", async () => {
  discoveryClearCacheBtn.disabled = true;
  setStatus(discoveryStatus, "Limpando cache...");
  try {
    const res = await api("/lead-discovery/cache", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Falha ao limpar cache");
    }
    const cleared = typeof data.cleared === "number" ? data.cleared : 0;
    setStatus(
      discoveryStatus,
      cleared
        ? `Cache limpo (${cleared} entrada(s)).`
        : "Cache já estava vazio.",
    );
  } catch (error) {
    setStatus(
      discoveryStatus,
      errorMessage(error, "Erro ao limpar cache"),
      true,
    );
  } finally {
    discoveryClearCacheBtn.disabled = false;
  }
});

discoveryHideSaved.addEventListener("change", () => {
  if (discoveryItems.length) {
    renderDiscoveryPage(1);
  }
});

enrichForm.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  setStatus(
    enrichStatus,
    "Enriquecendo... isso pode levar alguns segundos.",
  );
  enrichBtn.disabled = true;

  const payload: Record<string, string> = {
    name: formInput(enrichForm, "name").value.trim(),
  };
  for (const key of ["city", "state", "website", "instagram", "phone"] as const) {
    const value = formInput(enrichForm, key).value.trim();
    if (value) payload[key] = value;
  }

  try {
    const res = await api("/enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Falha no enrichment";
      throw new Error(msg);
    }
    setStatus(enrichStatus, `Lead enriquecido: ${data.id}`);
    renderLead(data as Lead);
    loadSavedLeads();
  } catch (error) {
    setStatus(enrichStatus, errorMessage(error, "Erro no enrichment"), true);
  } finally {
    enrichBtn.disabled = false;
  }
});

refreshLeadsBtn.addEventListener("click", () => loadSavedLeads());
refreshCustomersBtn.addEventListener("click", () => loadSavedCustomers());

function applyStudioChrome(user: StudioUser) {
  setStudioUser(user);
  currentUser = user;
  document.body.classList.remove("is-auth-pending");
  document.querySelectorAll<HTMLElement>("[data-admin-only]").forEach((node) => {
    node.hidden = !isStudioAdmin();
  });
  document.querySelectorAll<HTMLElement>("[data-feature]").forEach((node) => {
    const feature = node.dataset.feature;
    if (feature === "images") node.hidden = !canAccessImages(user);
    else if (feature === "videos") node.hidden = !canAccessVideos(user);
    else if (feature === "creative") node.hidden = !canAccessCreative(user);
  });
  const nameEl = document.getElementById("studio-user-name");
  if (nameEl) nameEl.textContent = user.name;
  const roleEl = document.getElementById("studio-user-role");
  if (roleEl) {
    roleEl.textContent =
      user.role === "ROOT"
        ? `Root · ${user.tenantName || "Namão"}`
        : user.role === "ADMIN"
          ? "Administrador"
          : "Operador";
  }
}

document.getElementById("studio-logout-btn")?.addEventListener("click", () => {
  void logoutStudio();
});

void requireStudioSession()
  .then((user) => {
    applyStudioChrome(user);
    loadSavedLeads();
    loadSavedCustomers();
    startRouter(applyRoute);
  })
  .catch(() => {
    /* redirect em requireStudioSession */
  });

function setSiteActionsEnabled(enabled: boolean) {
  siteAddBtn.disabled = !enabled;
  siteAgendaBtn.disabled = !enabled;
  siteSkillBtn.disabled = !enabled;
  const connected = Boolean(currentLead?.instagramConnections?.length);
  igSkillBtn.disabled = !enabled || !connected;
  igSkillBtn.title = connected
    ? "Analisar o feed conectado"
    : "Conecte o Instagram do lead";
}

function landingBadgeHtml(lead: Pick<Lead, "landingStatus" | "publishedOrigin" | "websiteProjectId" | "websiteDeployType" | "websiteRepo" | "websiteDomain">) {
  const repo = lead.websiteRepo || lead.websiteProjectId;
  if (repo) {
    const dest =
      lead.websiteDeployType === "vercel"
        ? "Vercel"
        : lead.websiteDeployType === "cloudflare"
          ? "Cloudflare"
          : "ligado";
    const domain =
      lead.websiteDeployType === "cloudflare" && lead.websiteDomain
        ? ` · ${lead.websiteDomain}`
        : "";
    return `<span class="landing-badge landing-badge--built">${escapeHtml(repo)} · ${escapeHtml(dest)}${escapeHtml(domain)}</span>`;
  }
  const value = lead.publishedOrigin ? "published" : lead.landingStatus || "none";
  const labels: Record<string, string> = {
    none: "sem site",
    linked: "ligado",
    scaffolded: "scaffold",
    generating: "gerando",
    built: "build OK",
    published: "publicado",
    build_failed: "build falhou",
    error: "erro",
    cancelled: "cancelado",
  };
  const cls =
    value === "built" || value === "published" || value === "linked"
      ? "landing-badge landing-badge--built"
      : value === "generating"
        ? "landing-badge landing-badge--generating"
        : value === "build_failed" || value === "error"
          ? "landing-badge landing-badge--failed"
          : "landing-badge";
  return `<span class="${cls}">${escapeHtml(labels[value] || value)}</span>`;
}

function updateLandingMeta() {
  siteAddBtn.textContent = "Configurar site";
}

function paintHeroHealth(health: WebsiteHealth | null, loading = false) {
  heroHealth.hidden = false;
  heroHealth.dataset.status = loading ? "idle" : health?.overall || "idle";
  heroHealthSummary.textContent = loading
    ? "Checando site…"
    : health?.summary || "Sem checagem ainda.";
  heroHealthList.innerHTML = loading || !health?.items.length
    ? ""
    : websiteHealthHostsHtml(health.items);
}

async function loadHeroHealth(lead: Lead) {
  const seq = ++heroHealthSeq;
  const linked = Boolean(lead.websiteRepo || lead.websiteProjectId);
  if (!lead.id || !linked) {
    heroHealth.hidden = true;
    heroHealthList.innerHTML = "";
    return;
  }
  paintHeroHealth(null, true);
  try {
    const res = await api(profileApi(entityKindOf(lead), lead.id, "/website/health"));
    const data = (await res.json().catch(() => ({}))) as WebsiteHealth & {
      message?: string | string[];
    };
    if (seq !== heroHealthSeq || currentLeadId !== lead.id) return;
    if (!res.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(" ")
        : data.message;
      throw new Error(message || "Falha ao checar o site");
    }
    paintHeroHealth(data);
  } catch (error) {
    if (seq !== heroHealthSeq || currentLeadId !== lead.id) return;
    paintHeroHealth({
      overall: "down",
      summary: errorMessage(error, "Não foi possível checar o site"),
      pagesDev: null,
      domain: lead.websiteDomain || null,
      items: [],
    });
  }
}

heroHealthRefresh.addEventListener("click", () => {
  if (currentLead) void loadHeroHealth(currentLead);
});

siteAddBtn.addEventListener("click", () => {
  if (!currentLeadId) return;
  leadWebsite.open(currentLeadId, currentEntityKind, currentLead);
});

siteAgendaBtn.addEventListener("click", () => {
  if (!currentLeadId) return;
  navigate(
    currentEntityKind === "customer"
      ? { name: "customer-calendar", id: currentLeadId }
      : { name: "lead-calendar", id: currentLeadId },
  );
});

siteSkillBtn.addEventListener("click", () => {
  if (!currentLeadId) return;
  siteSkill.open(currentLeadId, currentEntityKind, currentLead);
});

igSkillBtn.addEventListener("click", () => {
  if (!currentLeadId || !currentLead?.instagramConnections?.length) return;
  igSkill.open(currentLeadId, currentEntityKind, currentLead);
});

