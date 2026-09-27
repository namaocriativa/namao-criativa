import { api } from "./api";
import type { EntityKind } from "./profile-api";
import type { Lead } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PlanItem = {
  scheduledAt?: string;
  title?: string;
  hook?: string;
  caption?: string;
  format?: string;
};

type ContentPlan = {
  id: string;
  title: string;
  description?: string;
  postsPerWeek: number;
  weeks: number;
  formats?: string[];
  items: PlanItem[];
  status: string;
  createdAt?: string;
};

type OpenPayload = {
  ready?: boolean;
  reason?: "instagram_disconnected" | "ig_skill_required" | string;
  plans?: ContentPlan[];
  plan?: ContentPlan | null;
  message?: string | string[];
};

function formatLabel(format: string): string {
  if (format === "carousel") return "Carrossel";
  if (format === "reel") return "Reel";
  if (format === "static") return "Estático";
  return format;
}

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readError(payload: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(payload.message)) return payload.message.join(", ");
  return payload.message || fallback;
}

export function initContentPlanModal(host: HTMLElement): {
  open: (leadId: string, kind?: EntityKind, current?: Lead | null) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let kind: EntityKind = "lead";
  let busy = false;
  let draft: ContentPlan | null = null;
  let savedPlans: ContentPlan[] = [];

  host.innerHTML = `
    <div class="site-wizard-modal content-plan-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-cp-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="content-plan-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Skill</p>
            <h3 id="content-plan-title">Skill planejamento</h3>
          </div>
          <button type="button" class="outline" data-cp-close>Fechar</button>
        </header>
        <div data-cp-body></div>
        <p class="status" data-cp-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".content-plan-modal")!;
  const body = host.querySelector<HTMLElement>("[data-cp-body]")!;
  const status = host.querySelector<HTMLElement>("[data-cp-status]")!;

  function ownerQuery() {
    const key = kind === "customer" ? "customerId" : "leadId";
    return `${key}=${encodeURIComponent(leadId || "")}`;
  }

  function ownerBody() {
    return kind === "customer" ? { customerId: leadId } : { leadId };
  }

  function close() {
    modal.hidden = true;
    busy = false;
    draft = null;
    savedPlans = [];
    status.textContent = "";
  }

  function setStatus(message: string) {
    status.textContent = message;
  }

  function paintGate(reason?: string) {
    const needConn = reason === "instagram_disconnected";
    body.innerHTML = `
      <p class="lead-share-hint">O plano usa o relatório da Skill Instagram. Conclua as etapas abaixo.</p>
      <ol class="content-plan-steps">
        <li class="${needConn ? "is-todo" : "is-done"}">${needConn ? "Conecte o Instagram deste perfil." : "Instagram conectado."}</li>
        <li class="${needConn ? "is-todo" : "is-todo"}">${needConn ? "Depois rode a Skill Instagram e espere o relatório." : "Rode a Skill Instagram e espere o relatório."}</li>
      </ol>
    `;
  }

  function paintList() {
    if (!savedPlans.length) {
      paintForm();
      return;
    }
    const cards = savedPlans
      .map(
        (plan) => `
        <li>
          <button type="button" data-cp-open="${escapeHtml(plan.id)}">
            <strong>${escapeHtml(plan.title)}</strong>
            <span>${escapeHtml(plan.postsPerWeek)} posts/semana · ${escapeHtml(plan.weeks)} semanas · ${escapeHtml((plan.items || []).length)} peças</span>
            <span class="cal-idea-kicker">${escapeHtml(formatWhen(plan.createdAt))}</span>
          </button>
        </li>`,
      )
      .join("");
    body.innerHTML = `
      <p class="lead-share-hint">Planos confirmados deste perfil. Abra um ou crie outro.</p>
      <ul class="cal-create-list">${cards}</ul>
      <div class="actions">
        <button type="button" data-cp-new>Novo plano</button>
      </div>
    `;
  }

  function paintForm() {
    body.innerHTML = `
      <form class="content-plan-form" data-cp-form>
        <label>Título do plano
          <input name="title" required maxlength="200" placeholder="Ex.: Setembro — agenda cheia" />
        </label>
        <label>Descrição / brief
          <textarea name="description" rows="3" maxlength="4000" placeholder="Tom, oferta, o que evitar."></textarea>
        </label>
        <div class="content-plan-row">
          <label>Posts por semana
            <input name="postsPerWeek" type="number" min="1" max="7" value="3" required />
          </label>
          <label>Semanas
            <input name="weeks" type="number" min="2" max="8" value="4" required />
          </label>
        </div>
        <fieldset class="content-plan-formats">
          <legend>Tipos de post</legend>
          <label class="cal-check"><input type="checkbox" name="format" value="carousel" checked /> Carrossel</label>
          <label class="cal-check"><input type="checkbox" name="format" value="reel" checked /> Reel</label>
          <label class="cal-check"><input type="checkbox" name="format" value="static" /> Estático</label>
        </fieldset>
        <div class="actions">
          <button type="submit" data-cp-generate>Gerar plano</button>
        </div>
      </form>
    `;
  }

  function paintPlan(plan: ContentPlan, mode: "preview" | "saved") {
    const items = (plan.items || [])
      .map(
        (item) => `
        <article class="content-plan-item">
          <p class="cal-idea-kicker">${escapeHtml(formatWhen(item.scheduledAt))} · ${escapeHtml(formatLabel(item.format || ""))}</p>
          <strong>${escapeHtml(item.title || "")}</strong>
          <p>${escapeHtml(item.hook || "")}</p>
          <p class="meta">${escapeHtml(item.caption || "")}</p>
        </article>`,
      )
      .join("");
    body.innerHTML = `
      <p class="meta">${escapeHtml(plan.title)} · ${escapeHtml(plan.postsPerWeek)} posts/semana · ${escapeHtml(plan.weeks)} semanas</p>
      ${plan.description ? `<p class="lead-share-hint">${escapeHtml(plan.description)}</p>` : ""}
      <div class="ig-skill-report__body content-plan-list">${items}</div>
      <div class="actions">
        ${
          mode === "preview"
            ? `<button type="button" data-cp-confirm>Confirmar</button>
               <button type="button" class="secondary" data-cp-discard>Descartar</button>`
            : `<button type="button" class="secondary" data-cp-list>Planos</button>
               <button type="button" data-cp-new>Novo plano</button>`
        }
      </div>
    `;
  }

  async function loadOpen() {
    if (!leadId) return;
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
      savedPlans = data.plans?.length ? data.plans : data.plan ? [data.plan] : [];
      if (savedPlans.length) {
        paintList();
        return;
      }
      paintForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha");
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
          title: String(data.get("title") || "").trim(),
          description: String(data.get("description") || "").trim(),
          postsPerWeek: Number(data.get("postsPerWeek") || 3),
          weeks: Number(data.get("weeks") || 4),
          formats,
        }),
      });
      const payload = (await res.json()) as ContentPlan & { message?: string | string[] };
      if (!res.ok || !payload.id) {
        throw new Error(readError(payload, "Não gerou o plano"));
      }
      draft = payload;
      setStatus("Revise e confirme ou descarte.");
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
      setStatus("Plano salvo.");
      paintPlan(payload, "saved");
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
    if (node.closest("[data-cp-close]")) {
      close();
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
      paintPlan(plan, "saved");
    }
  });

  host.addEventListener("submit", (event) => {
    if ((event.target as HTMLElement).closest("[data-cp-form]")) {
      void generate(event);
    }
  });

  return {
    open(id, nextKind = "lead") {
      leadId = id;
      kind = nextKind;
      draft = null;
      savedPlans = [];
      busy = false;
      status.textContent = "";
      modal.hidden = false;
      void loadOpen();
    },
    close,
  };
}
