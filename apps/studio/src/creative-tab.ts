import { api } from "./api";
import {
  CAROUSEL_INSTAGRAM_ID,
  FLYER_VENDA_LANDING_ID,
  INICIO_FIM_ID,
  MOVIES_ID,
  PERSONAGENS_ID,
  UGC_SKILLS_ID,
} from "./creative/features";
import { navigate, type AppRoute } from "./router";
import type { AgencyPackage, Lead } from "./types";

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

function formatPrice(pkg: AgencyPackage): string {
  const full = formatMoney(pkg.price, pkg.currency);
  const promo = formatMoney(pkg.promoPrice, pkg.currency);
  if (full && promo) return `de ${full} por ${promo}`;
  return full || "Sob consulta";
}

export function initCreativeTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("imagens-skill-form");
  const statusEl = requireEl<HTMLElement>("imagens-skill-status");

  let leads: Lead[] = [];
  let packages: AgencyPackage[] = [];
  let selectedLead: Lead | null = null;
  let selectedPackageIds: string[] = [];
  let busy = false;
  let catalogsLoaded = false;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function renderComposer() {
    const leadLabel = selectedLead
      ? `${selectedLead.name || "Lead"}${selectedLead.category ? ` · ${selectedLead.category}` : ""}`
      : "";
    const leadOptions = leads
      .slice(0, 40)
      .map((lead) => {
        const label = `${lead.name || "Lead"}${lead.category ? ` · ${lead.category}` : ""}${lead.city ? ` · ${lead.city}` : ""}`;
        return `<li><button type="button" data-lead-id="${escapeHtml(lead.id || "")}">${escapeHtml(label)}</button></li>`;
      })
      .join("");
    const packageChips = packages
      .map((pkg) => {
        const checked = selectedPackageIds.includes(pkg.id);
        return `<label class="criativo-chip ${checked ? "active" : ""}">
          <input type="checkbox" value="${escapeHtml(pkg.id)}" ${checked ? "checked" : ""} />
          <span>${escapeHtml(pkg.name)}</span>
          <em>${escapeHtml(formatPrice(pkg))}</em>
        </label>`;
      })
      .join("");

    composerEl.innerHTML = `
      <form id="criativo-flyer-form" class="criativo-flyer-form">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Flyer de venda</p>
          <h3>Personalize a oferta da Namão para o lead</h3>
        </div>
        <label class="field-combo">
          Lead
          <input
            type="search"
            id="criativo-lead-search"
            placeholder="Buscar por nome, categoria ou cidade"
            value="${escapeHtml(leadLabel)}"
            autocomplete="off"
          />
          <ul id="criativo-lead-suggestions" class="city-suggestions criativo-suggestions" role="listbox" hidden>
            ${leadOptions || `<li class="empty-filter">Nenhum lead encontrado</li>`}
          </ul>
        </label>
        <div>
          <p class="criativo-field-label">Pacotes (1 ou 2)</p>
          <div class="criativo-chips" id="criativo-packages">${packageChips || "<p class='criativo-empty'>Cadastre pacotes ativos para usar no flyer.</p>"}</div>
        </div>
        <label>
          Notas
          <textarea id="criativo-notes" rows="3" placeholder="Ex.: Pacote I de R$ 1.200 por R$ 800 (33%). Enfatizar agenda e WhatsApp."></textarea>
        </label>
        <div class="criativo-composer-actions">
          <button type="submit" id="criativo-generate-btn">Gerar flyer</button>
        </div>
      </form>`;

    const form = composerEl.querySelector("#criativo-flyer-form") as HTMLFormElement | null;
    const search = composerEl.querySelector("#criativo-lead-search") as HTMLInputElement | null;
    const suggestions = composerEl.querySelector("#criativo-lead-suggestions") as HTMLElement | null;
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generateFlyer();
    });
    search?.addEventListener("focus", () => {
      if (suggestions) suggestions.hidden = false;
    });
    search?.addEventListener("input", () => {
      selectedLead = null;
      filterLeadSuggestions(search.value);
    });
    suggestions?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement | null)?.closest("[data-lead-id]") as HTMLElement | null;
      if (!btn?.dataset.leadId) return;
      const lead = leads.find((item) => item.id === btn.dataset.leadId) || null;
      selectedLead = lead;
      if (search && lead) {
        search.value = `${lead.name || "Lead"}${lead.category ? ` · ${lead.category}` : ""}`;
      }
      if (suggestions) suggestions.hidden = true;
    });
    composerEl.querySelector("#criativo-packages")?.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input || input.type !== "checkbox") return;
      const label = input.closest(".criativo-chip");
      if (input.checked) {
        if (selectedPackageIds.length >= 2) {
          input.checked = false;
          setStatus("Selecione no máximo dois pacotes", true);
          return;
        }
        selectedPackageIds = [...selectedPackageIds, input.value];
        label?.classList.add("active");
      } else {
        selectedPackageIds = selectedPackageIds.filter((id) => id !== input.value);
        label?.classList.remove("active");
      }
    });
  }

  function renderCarouselComposer() {
    composerEl.innerHTML = `
      <form id="criativo-carousel-form" class="criativo-flyer-form">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Carrossel Instagram</p>
          <h3>Um briefing vira uma série 4:5 para o feed</h3>
        </div>
        <label>
          Briefing
          <textarea id="criativo-carousel-prompt" rows="5" required placeholder="Ex.: 5 slides sobre hábitos de hidratação para quem treina de manhã. Tom direto, CTA para salvar."></textarea>
        </label>
        <label>
          Quantidade de slides
          <select id="criativo-carousel-count">
            <option value="3">3 slides</option>
            <option value="4">4 slides</option>
            <option value="5" selected>5 slides</option>
            <option value="6">6 slides</option>
            <option value="7">7 slides</option>
          </select>
        </label>
        <label>
          Notas
          <textarea id="criativo-carousel-notes" rows="3" placeholder="Tom, oferta, paleta ou CTA. Opcional."></textarea>
        </label>
        <div class="criativo-composer-actions">
          <button type="submit" id="criativo-carousel-btn">Gerar carrossel</button>
        </div>
      </form>`;
    composerEl.querySelector("#criativo-carousel-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generateCarousel();
    });
  }

  function filterLeadSuggestions(query: string) {
    const suggestions = composerEl.querySelector("#criativo-lead-suggestions") as HTMLElement | null;
    if (!suggestions) return;
    const needle = query.trim().toLowerCase();
    const matches = leads.filter((lead) => {
      if (!needle) return true;
      return [lead.name, lead.category, lead.city, lead.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    suggestions.innerHTML = matches.length
      ? matches
          .slice(0, 40)
          .map((lead) => {
            const label = `${lead.name || "Lead"}${lead.category ? ` · ${lead.category}` : ""}${lead.city ? ` · ${lead.city}` : ""}`;
            return `<li><button type="button" data-lead-id="${escapeHtml(lead.id || "")}">${escapeHtml(label)}</button></li>`;
          })
          .join("")
      : `<li class="empty-filter">Nenhum lead encontrado</li>`;
    suggestions.hidden = false;
  }

  async function loadCatalogs() {
    if (catalogsLoaded) return;
    try {
      const [leadsRes, packagesRes] = await Promise.all([
        api("/leads"),
        api("/packages"),
      ]);
      if (!leadsRes.ok) throw new Error(await readError(leadsRes, "Falha ao listar leads"));
      if (!packagesRes.ok) {
        throw new Error(await readError(packagesRes, "Falha ao listar pacotes"));
      }
      leads = (await leadsRes.json()) as Lead[];
      const items = (await packagesRes.json()) as AgencyPackage[];
      const active = items.filter((item) => item.status === "active");
      packages = active.length ? active : items;
      if (!selectedPackageIds.length) {
        selectedPackageIds = packages.slice(0, Math.min(2, packages.length)).map((item) => item.id);
      }
      catalogsLoaded = true;
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao carregar leads e pacotes"), true);
    }
  }

  async function generateFlyer() {
    if (busy) return;
    const notes = (composerEl.querySelector("#criativo-notes") as HTMLTextAreaElement | null)
      ?.value;
    if (!selectedLead?.id) {
      const search = composerEl.querySelector("#criativo-lead-search") as HTMLInputElement | null;
      const needle = search?.value.trim().toLowerCase() || "";
      selectedLead =
        leads.find((lead) => (lead.name || "").toLowerCase() === needle) ||
        leads.find((lead) =>
          [lead.name, lead.category].filter(Boolean).join(" · ").toLowerCase() === needle,
        ) ||
        null;
    }
    if (!selectedLead?.id) {
      setStatus("Selecione um lead", true);
      return;
    }
    if (!selectedPackageIds.length) {
      setStatus("Selecione ao menos um pacote", true);
      return;
    }
    busy = true;
    const btn = composerEl.querySelector("#criativo-generate-btn") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setStatus("Planejando o copy e gerando o flyer. Isso pode levar até um minuto…");
    try {
      const res = await api("/creative/features/flyer-venda-landing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          packageIds: selectedPackageIds,
          notes: notes?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar flyer"));
      const payload = (await res.json()) as { projectId: string };
      navigate({ name: "imagens-project", id: payload.projectId });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar flyer"), true);
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }

  async function generateCarousel() {
    if (busy) return;
    const prompt = (
      composerEl.querySelector("#criativo-carousel-prompt") as HTMLTextAreaElement | null
    )?.value.trim();
    const notes = (
      composerEl.querySelector("#criativo-carousel-notes") as HTMLTextAreaElement | null
    )?.value;
    const slideCount = Number(
      (composerEl.querySelector("#criativo-carousel-count") as HTMLSelectElement | null)
        ?.value || 5,
    );
    if (!prompt) {
      setStatus("Escreva o briefing do carrossel", true);
      return;
    }
    busy = true;
    const btn = composerEl.querySelector("#criativo-carousel-btn") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setStatus("Gerando o carrossel… Isso pode levar alguns minutos.");
    try {
      const res = await api("/creative/features/carousel-instagram/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          slideCount,
          notes: notes?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar o carrossel"));
      const payload = (await res.json()) as { projectId: string; error?: string };
      if (!payload.projectId) throw new Error("Projeto não retornado");
      navigate({ name: "imagens-project", id: payload.projectId });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar o carrossel"), true);
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const suggestions = composerEl.querySelector("#criativo-lead-suggestions") as HTMLElement | null;
    if (!suggestions || suggestions.hidden) return;
    const target = event.target as Node | null;
    if (target && composerEl.contains(target)) return;
    suggestions.hidden = true;
  });

  function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill") return;
    if (
      route.id === PERSONAGENS_ID ||
      route.id === MOVIES_ID ||
      route.id === INICIO_FIM_ID ||
      route.id === UGC_SKILLS_ID
    ) {
      return;
    }
    if (route.id === FLYER_VENDA_LANDING_ID) {
      setStatus("");
      void loadCatalogs().then(() => {
        renderComposer();
      });
      renderComposer();
      return;
    }
    if (route.id === CAROUSEL_INSTAGRAM_ID) {
      setStatus("");
      renderCarouselComposer();
      return;
    }
    composerEl.innerHTML = `<p class="criativo-empty">Habilidade não encontrada.</p>`;
    setStatus("");
  }

  return { onRoute };
}
