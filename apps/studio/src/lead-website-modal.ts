import { api } from "./api";
import { profileApi, type EntityKind } from "./profile-api";
import type { Lead } from "./types";

export type WebsiteProject = {
  id: string;
  title: string;
  repo: string;
  defaultBranch?: string;
};

type CatalogPayload = {
  projects?: WebsiteProject[];
  message?: string | string[];
};

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

function apiMessage(data: CatalogPayload, fallback: string): string {
  if (Array.isArray(data.message)) return data.message.join(" ");
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

function projectFromLead(lead: Lead | null | undefined): WebsiteProject | null {
  const id = lead?.websiteRepo || lead?.websiteProjectId;
  if (!id) return null;
  return {
    id,
    title: lead?.websiteProjectId || id,
    repo: lead?.websiteRepo || id,
  };
}

export function initLeadWebsiteModal(
  host: HTMLElement,
  opts: { onLinked: (lead: Lead) => void },
): {
  open: (leadId: string, kind?: EntityKind, current?: Lead | null) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let apiKind: EntityKind = "lead";
  let currentLead: Lead | null = null;
  let busy = false;
  let projects: WebsiteProject[] = [];
  let selected: WebsiteProject | null = null;
  let query = "";
  let rememberedDomain = "";

  host.innerHTML = `
    <div class="site-wizard-modal lead-website-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-website-close
        aria-label="Fechar configuração de site"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-website-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-website-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Site</p>
            <h3 id="lead-website-title">Configurar site</h3>
          </div>
          <button type="button" class="outline" data-website-close>Fechar</button>
        </header>
        <p class="lead-share-hint" data-website-hint></p>
        <div data-website-step="pick">
          <label>
            Buscar repositório
            <input type="search" data-website-search placeholder="owner/nome" autocomplete="off" />
          </label>
          <ul class="lead-share-list" data-website-list></ul>
        </div>
        <div data-website-step="deploy" hidden>
          <div class="lead-website-dest">
            <label class="lead-website-choice">
              <input type="radio" name="website-deploy" value="cloudflare" />
              Cloudflare Pages
            </label>
            <label class="lead-website-choice">
              <input type="radio" name="website-deploy" value="vercel" />
              Vercel
            </label>
            <label data-website-domain-wrap hidden>
              Domínio (opcional)
              <input
                type="text"
                data-website-domain
                placeholder="paulinhocabelos.com.br"
                autocomplete="off"
              />
              <span class="lead-share-hint">Só use se a zona DNS estiver na mesma conta Cloudflare do Pages. Apex e www são anexados juntos.</span>
            </label>
            <label class="lead-website-choice">
              <input type="checkbox" data-website-now />
              Também publicar agora (precisa do cd.yml no repo)
            </label>
          </div>
          <p class="movies-toolbar">
            <button type="button" data-website-confirm>Salvar</button>
            <button type="button" class="secondary" data-website-sync hidden>
              Sincronizar domínio
            </button>
            <button type="button" class="outline" data-website-back>Trocar repositório</button>
          </p>
        </div>
        <p class="status" data-website-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-website-modal")!;
  const title = host.querySelector<HTMLElement>("#lead-website-title")!;
  const hint = host.querySelector<HTMLElement>("[data-website-hint]")!;
  const listEl = host.querySelector<HTMLElement>("[data-website-list]")!;
  const searchEl = host.querySelector<HTMLInputElement>("[data-website-search]")!;
  const pickStep = host.querySelector<HTMLElement>('[data-website-step="pick"]')!;
  const deployStep = host.querySelector<HTMLElement>('[data-website-step="deploy"]')!;
  const nowEl = host.querySelector<HTMLInputElement>("[data-website-now]")!;
  const domainWrap = host.querySelector<HTMLElement>("[data-website-domain-wrap]")!;
  const domainEl = host.querySelector<HTMLInputElement>("[data-website-domain]")!;
  const syncBtn = host.querySelector<HTMLButtonElement>("[data-website-sync]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-website-status]")!;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function selectedDeployType(): "cloudflare" | "vercel" | null {
    const checked = host.querySelector<HTMLInputElement>(
      'input[name="website-deploy"]:checked',
    );
    if (checked?.value === "cloudflare" || checked?.value === "vercel") {
      return checked.value;
    }
    return null;
  }

  function domainValue(): string {
    return domainEl.value.trim();
  }

  function syncAvailable(): boolean {
    if (selectedDeployType() !== "cloudflare") return false;
    return Boolean(domainValue() || currentLead?.websiteDomain);
  }

  function refreshDeployFields() {
    const type = selectedDeployType();
    const cloudflare = type === "cloudflare";
    domainWrap.hidden = !cloudflare;
    if (cloudflare && !domainEl.value && rememberedDomain) {
      domainEl.value = rememberedDomain;
    }
    syncBtn.hidden = !syncAvailable();
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    selected = null;
    query = "";
    searchEl.value = "";
    nowEl.checked = false;
    setStatus("");
    showPick();
  }

  function showPick() {
    selected = null;
    title.textContent = "Configurar site";
    hint.textContent =
      "Escolha um repositório do GitHub. O destino e o domínio (Cloudflare) ficam no passo seguinte.";
    pickStep.hidden = false;
    deployStep.hidden = true;
  }

  function showDeploy(project: WebsiteProject, prefill?: Lead | null) {
    selected = project;
    title.textContent = "Configurar site";
    hint.textContent = `Destino e domínio de ${project.id}. Sem Cloudflare o domínio é ignorado.`;
    const radios = host.querySelectorAll<HTMLInputElement>(
      'input[name="website-deploy"]',
    );
    const nextType =
      prefill?.websiteDeployType === "vercel" ||
      prefill?.websiteDeployType === "cloudflare"
        ? prefill.websiteDeployType
        : null;
    for (const radio of radios) {
      radio.checked = radio.value === nextType;
    }
    rememberedDomain = prefill?.websiteDomain || rememberedDomain || "";
    domainEl.value = rememberedDomain;
    nowEl.checked = false;
    pickStep.hidden = true;
    deployStep.hidden = false;
    refreshDeployFields();
  }

  function filteredProjects(): WebsiteProject[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((item) =>
      [item.id, item.title, item.repo].join(" ").toLowerCase().includes(needle),
    );
  }

  function renderProjects() {
    const items = filteredProjects();
    if (!items.length) {
      listEl.innerHTML = `<li class="empty-filter">${
        projects.length
          ? "Nenhum repositório corresponde à busca."
          : "Nenhum repositório visível para este token."
      }</li>`;
      return;
    }
    listEl.innerHTML = items
      .slice(0, 80)
      .map(
        (item) => `<li>
          <div>
            <strong>${escapeHtml(item.id)}</strong>
            <div class="meta">${escapeHtml(item.repo)}</div>
          </div>
          <button type="button" data-website-project="${escapeHtml(item.id)}">Escolher</button>
        </li>`,
      )
      .join("");
  }

  async function loadCatalog() {
    setStatus("Carregando repositórios do GitHub…");
    try {
      const res = await api("/website-projects");
      const data = (await res.json().catch(() => ({}))) as CatalogPayload;
      if (!res.ok) throw new Error(apiMessage(data, "Falha ao listar o GitHub"));
      projects = data.projects || [];
      renderProjects();
      setStatus("");
    } catch (error) {
      projects = [];
      renderProjects();
      setStatus(errorMessage(error, "Falha ao listar o GitHub"), true);
    }
  }

  async function save(optsSave: { deployNow: boolean; syncDomain: boolean }) {
    if (!leadId || !selected || busy) return;
    const deployType = selectedDeployType();
    if (!deployType) {
      setStatus("Escolha Cloudflare Pages ou Vercel.", true);
      return;
    }
    if (
      optsSave.deployNow &&
      !window.confirm(`Disparar a Action de ${selected.id} agora?`)
    ) {
      return;
    }
    busy = true;
    setStatus(
      optsSave.syncDomain
        ? "Salvando e sincronizando o domínio…"
        : optsSave.deployNow
          ? "Salvando e disparando a Action…"
          : "Salvando configuração…",
    );
    try {
      const res = await api(profileApi(apiKind, leadId, "/website"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selected.id,
          deployType,
          deployNow: optsSave.deployNow,
          domain: domainValue(),
          syncDomain: optsSave.syncDomain,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Lead & CatalogPayload;
      if (!res.ok) throw new Error(apiMessage(data, "Falha ao salvar o site"));
      currentLead = { ...data, _entityKind: apiKind };
      rememberedDomain = currentLead.websiteDomain || "";
      opts.onLinked(currentLead);
      if (optsSave.syncDomain) {
        setStatus("Domínio sincronizado no Cloudflare Pages.");
        refreshDeployFields();
        return;
      }
      close();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar o site"), true);
    } finally {
      busy = false;
    }
  }

  async function syncDomain() {
    if (!leadId || !selected || busy) return;
    if (selectedDeployType() !== "cloudflare") {
      setStatus("Sincronizar domínio vale só no Cloudflare Pages.", true);
      return;
    }
    if (!syncAvailable()) {
      setStatus("Informe o domínio para sincronizar, ou limpe o atual.", true);
      return;
    }
    busy = true;
    setStatus("Sincronizando domínio no Cloudflare…");
    try {
      const res = await api(profileApi(apiKind, leadId, "/website/domain/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainValue() }),
      });
      const data = (await res.json().catch(() => ({}))) as Lead & CatalogPayload;
      if (!res.ok) throw new Error(apiMessage(data, "Falha ao sincronizar o domínio"));
      currentLead = { ...data, _entityKind: apiKind };
      rememberedDomain = currentLead.websiteDomain || domainValue();
      opts.onLinked(currentLead);
      setStatus(
        currentLead.websiteDomain
          ? `Domínio ${currentLead.websiteDomain} sincronizado no Pages.`
          : "Domínio removido do Pages.",
      );
      refreshDeployFields();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao sincronizar o domínio"), true);
    } finally {
      busy = false;
    }
  }

  function open(nextId: string, kind: EntityKind = "lead", current?: Lead | null) {
    leadId = nextId;
    apiKind = kind;
    currentLead = current || null;
    rememberedDomain = current?.websiteDomain || "";
    setStatus("");
    const existing = projectFromLead(current);
    if (existing) {
      showDeploy(existing, current);
    } else {
      showPick();
    }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    void loadCatalog();
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    renderProjects();
  });
  domainEl.addEventListener("input", () => {
    rememberedDomain = domainEl.value;
    refreshDeployFields();
  });
  host.addEventListener("change", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input[name="website-deploy"]')) {
      refreshDeployFields();
    }
  });
  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-website-close]")) {
      close();
      return;
    }
    if (target?.closest("[data-website-back]")) {
      showPick();
      return;
    }
    if (target?.closest("[data-website-confirm]")) {
      void save({ deployNow: nowEl.checked, syncDomain: false });
      return;
    }
    if (target?.closest("[data-website-sync]")) {
      void syncDomain();
      return;
    }
    const projectId = target?.closest<HTMLElement>("[data-website-project]")
      ?.dataset.websiteProject;
    if (projectId) {
      const project = projects.find((item) => item.id === projectId);
      if (project) showDeploy(project, currentLead);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || modal.hidden) return;
    if (!deployStep.hidden && !projectFromLead(currentLead)) {
      showPick();
      return;
    }
    close();
  });

  return { open, close };
}
