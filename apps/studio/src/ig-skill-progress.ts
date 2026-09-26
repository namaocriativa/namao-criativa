import { api } from "./api";

type Job = {
  id: string;
  status: string;
  stage: string;
  error?: string | null;
  log?: Array<{ stage: string; message: string }>;
  report?: unknown;
};

const STAGES = ["queued", "media", "compact", "plan", "done"];

export function initIgSkillProgress(opts: { onDone: (job: Job) => void }) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let jobId: string | null = null;
  let finished = false;

  const host = document.createElement("aside");
  host.id = "ig-skill-toast";
  host.className = "site-skill-toast";
  host.hidden = true;
  host.innerHTML = `
    <p class="kicker">Skill Instagram</p>
    <strong data-ig-stage>Na fila</strong>
    <div class="site-skill-toast__bar" role="progressbar"><span data-ig-fill></span></div>
    <p class="meta" data-ig-msg></p>
  `;
  document.body.appendChild(host);

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function paint(job: Job) {
    const fill = host.querySelector<HTMLElement>("[data-ig-fill]");
    const stageEl = host.querySelector<HTMLElement>("[data-ig-stage]");
    const msg = host.querySelector<HTMLElement>("[data-ig-msg]");
    const idx = Math.max(0, STAGES.indexOf(job.stage));
    const pct = job.status === "done" ? 100 : Math.round(((idx + 1) / STAGES.length) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (stageEl) stageEl.textContent = job.stage;
    const last = job.log?.length ? job.log[job.log.length - 1]?.message : "";
    if (msg) msg.textContent = job.error || last || "";
    host.classList.toggle("is-error", job.status === "error");
    host.classList.toggle("is-done", job.status === "done");
    if (job.status === "done" || job.status === "error") stop();
    if (job.status === "done" && !finished) {
      finished = true;
      opts.onDone(job);
    }
  }

  async function tick() {
    if (!jobId) return;
    try {
      const res = await api(`/ig-skill/jobs/${encodeURIComponent(jobId)}`);
      if (!res.ok) return;
      paint((await res.json()) as Job);
    } catch {
      /* poll */
    }
  }

  return {
    watch(id: string) {
      jobId = id;
      finished = false;
      host.hidden = false;
      host.classList.remove("is-error", "is-done");
      paint({ id, status: "queued", stage: "queued", log: [] });
      stop();
      void tick();
      timer = setInterval(() => void tick(), 2500);
    },
  };
}
