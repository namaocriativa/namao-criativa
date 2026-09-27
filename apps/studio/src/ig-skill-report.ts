import { api } from "./api";
import type { EntityKind } from "./profile-api";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Idea = {
  title?: string;
  hook?: string;
  caption?: string;
  format?: string;
  commentKeyword?: string;
};

type Report = {
  overview?: { who?: string; sells?: string; audience?: string; stage?: string };
  voice?: { adjectives?: string[]; quotes?: string[] };
  pillars?: string[];
  gaps?: string[];
  plan?: Array<{ week?: string; mix?: string; goal?: string }>;
  ideas?: Idea[];
  corpus?: { postCount?: number; postsPerWeek?: number; username?: string | null };
};

export function initIgSkillReport(host: HTMLElement): {
  open: (report: Report, owner: { id: string; kind: EntityKind }) => void;
  openJob: (jobId: string, owner: { id: string; kind: EntityKind }) => Promise<void>;
  openLatest: (owner: { id: string; kind: EntityKind }) => Promise<void>;
  close: () => void;
} {
  let owner: { id: string; kind: EntityKind } | null = null;
  let ideas: Idea[] = [];

  host.innerHTML = `
    <div class="site-wizard-modal ig-skill-report" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-ig-report-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Relatório</p>
            <h3>Skill Instagram</h3>
          </div>
          <button type="button" class="outline" data-ig-report-close>Fechar</button>
        </header>
        <div data-ig-report-body class="ig-skill-report__body"></div>
        <p class="status" data-ig-report-status></p>
        <div class="actions">
          <button type="button" data-ig-send>Mandar para a agenda</button>
        </div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".ig-skill-report")!;
  const body = host.querySelector<HTMLElement>("[data-ig-report-body]")!;
  const status = host.querySelector<HTMLElement>("[data-ig-report-status]")!;

  function close() {
    modal.hidden = true;
  }

  function paint(report: Report) {
    const ov = report.overview || {};
    const voice = report.voice || {};
    const corpus = report.corpus || {};
    ideas = report.ideas || [];
    body.innerHTML = `
      <p class="meta">${escapeHtml(corpus.username ? `@${corpus.username}` : "feed")} · ${escapeHtml(corpus.postCount ?? 0)} posts · ${escapeHtml(corpus.postsPerWeek ?? 0)}/semana</p>
      <h4>Overview</h4>
      <p>${escapeHtml(ov.who)} — ${escapeHtml(ov.sells)}. Público: ${escapeHtml(ov.audience)}. Estágio: ${escapeHtml(ov.stage)}.</p>
      <h4>Voz</h4>
      <p>${escapeHtml((voice.adjectives || []).join(", "))}</p>
      <ul>${(voice.quotes || []).map((q) => `<li>“${escapeHtml(q)}”</li>`).join("")}</ul>
      <h4>Pilares</h4>
      <ul>${(report.pillars || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <h4>Gaps</h4>
      <ul>${(report.gaps || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <h4>Plano</h4>
      <ul>${(report.plan || []).map((week) => `<li><strong>${escapeHtml(week.week)}</strong> · ${escapeHtml(week.mix)} — ${escapeHtml(week.goal)}</li>`).join("")}</ul>
      <h4>Ideias</h4>
      <ol>${ideas.map((idea) => `<li><strong>${escapeHtml(idea.title)}</strong> (${escapeHtml(idea.format)}) — ${escapeHtml(idea.hook)}</li>`).join("")}</ol>
    `;
  }

  async function sendToCalendar() {
    if (!owner || !ideas.length) return;
    status.textContent = "Enviando…";
    try {
      const res = await api("/calendar/posts/from-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(owner.kind === "customer" ? { customerId: owner.id } : { leadId: owner.id }),
          platforms: ["instagram"],
          ideas: ideas.map((idea) => ({
            title: idea.title || "Post",
            hook: idea.hook || idea.title || "Post",
            caption: idea.caption || idea.hook || "",
            format: idea.format || "static",
            commentKeyword: idea.commentKeyword,
          })),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Não criou os posts");
      status.textContent = "5 ideias na agenda.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Falha";
    }
  }

  host.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-ig-report-close]")) close();
    if (node.closest("[data-ig-send]")) void sendToCalendar();
  });

  return {
    open(report, nextOwner) {
      owner = nextOwner;
      status.textContent = "";
      paint(report);
      modal.hidden = false;
    },
    async openJob(jobId, nextOwner) {
      const res = await api(`/ig-skill/jobs/${encodeURIComponent(jobId)}`);
      const data = (await res.json()) as { report?: Report };
      if (!res.ok || !data.report) return;
      this.open(data.report, nextOwner);
    },
    async openLatest(nextOwner) {
      const qs =
        nextOwner.kind === "customer"
          ? `customerId=${encodeURIComponent(nextOwner.id)}`
          : `leadId=${encodeURIComponent(nextOwner.id)}`;
      const res = await api(`/ig-skill/latest?${qs}`);
      const data = (await res.json()) as { job?: { report?: Report } | null };
      if (!res.ok || !data.job?.report) return;
      this.open(data.job.report, nextOwner);
    },
    close,
  };
}
