import { api } from "./api";
import {
  buildIgReportPdf,
  formatIgReportText,
  igReportPdfName,
  type IgReportExport,
} from "./ig-skill-report-export";
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

type Report = IgReportExport;

export function initIgSkillReport(host: HTMLElement): {
  open: (report: Report, owner: { id: string; kind: EntityKind }) => void;
  openJob: (jobId: string, owner: { id: string; kind: EntityKind }) => Promise<void>;
  openLatest: (owner: { id: string; kind: EntityKind }) => Promise<void>;
  close: () => void;
} {
  let owner: { id: string; kind: EntityKind } | null = null;
  let ideas: Idea[] = [];
  let report: Report | null = null;

  host.innerHTML = `
    <div class="site-wizard-modal ig-skill-report" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-ig-report-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Relatório</p>
            <h3>Skill Instagram</h3>
          </div>
          <div class="ig-skill-report__tools">
            <button type="button" class="outline ig-skill-report__icon" data-ig-report-copy aria-label="Copiar relatório" title="Copiar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
            </button>
            <button type="button" class="outline ig-skill-report__icon" data-ig-report-pdf aria-label="Exportar PDF" title="Exportar PDF">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7.2L19 8.2V20.5H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3.5V8.5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 11.2v6M9.2 14.6 12 17.2l2.8-2.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="outline" data-ig-report-close>Fechar</button>
          </div>
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

  function paint(next: Report) {
    report = next;
    const ov = next.overview || {};
    const voice = next.voice || {};
    const corpus = next.corpus || {};
    ideas = next.ideas || [];
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

  function copyWithSelection(text: string): boolean {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  function copyReport() {
    if (!report) return;
    const text = formatIgReportText(report);
    if (copyWithSelection(text)) {
      status.textContent = "Relatório copiado.";
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      status.textContent = "Não foi possível copiar.";
      return;
    }
    void clipboard.writeText(text).then(
      () => {
        status.textContent = "Relatório copiado.";
      },
      () => {
        status.textContent = "Não foi possível copiar.";
      },
    );
  }

  function exportPdf() {
    if (!report) return;
    const bytes = buildIgReportPdf(report);
    const blob = new Blob(
      [
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ],
      { type: "application/pdf" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = igReportPdfName(report);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "PDF exportado.";
  }

  host.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-ig-report-copy]")) {
      copyReport();
      return;
    }
    if (node.closest("[data-ig-report-pdf]")) {
      exportPdf();
      return;
    }
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
