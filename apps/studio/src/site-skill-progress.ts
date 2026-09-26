import { api } from "./api";

type Job = {
  id: string;
  status: string;
  stage: string;
  repo?: string;
  slug?: string;
  error?: string | null;
  log?: Array<{ stage: string; message: string }>;
};

const STAGES = [
  "queued",
  "scaffold",
  "prompt",
  "code",
  "media",
  "github",
  "link",
  "clone",
  "done",
];

export function initSiteSkillProgress() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let jobId: string | null = null;

  const host = document.createElement("aside");
  host.id = "site-skill-toast";
  host.className = "site-skill-toast";
  host.hidden = true;
  host.innerHTML = `
    <p class="kicker">Skill site lead</p>
    <strong data-skill-stage>Na fila</strong>
    <div class="site-skill-toast__bar" role="progressbar"><span data-skill-fill></span></div>
    <p class="meta" data-skill-msg></p>
  `;
  document.body.appendChild(host);

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function paint(job: Job) {
    const fill = host.querySelector<HTMLElement>("[data-skill-fill]");
    const stageEl = host.querySelector<HTMLElement>("[data-skill-stage]");
    const msg = host.querySelector<HTMLElement>("[data-skill-msg]");
    const idx = Math.max(0, STAGES.indexOf(job.stage));
    const pct = job.status === "done" ? 100 : Math.round(((idx + 1) / STAGES.length) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (stageEl) stageEl.textContent = job.stage;
    const last = job.log?.length ? job.log[job.log.length - 1]?.message : "";
    if (msg) {
      if (job.status === "done" && job.repo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(job.repo)) {
        const link = document.createElement("a");
        link.href = `https://github.com/${job.repo}`;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = job.repo;
        msg.replaceChildren(link);
      } else {
        msg.textContent = job.error || last || "";
      }
    }
    host.classList.toggle("is-error", job.status === "error");
    host.classList.toggle("is-done", job.status === "done");
    if (job.status === "done" || job.status === "error") stop();
  }

  async function tick() {
    if (!jobId) return;
    try {
      const res = await api(`/site-skill/jobs/${encodeURIComponent(jobId)}`);
      if (!res.ok) return;
      paint((await res.json()) as Job);
    } catch {
      /* ignore poll */
    }
  }

  return {
    watch(id: string) {
      jobId = id;
      host.hidden = false;
      host.classList.remove("is-error", "is-done");
      paint({ id, status: "queued", stage: "queued", log: [] });
      stop();
      void tick();
      timer = setInterval(() => void tick(), 2500);
    },
  };
}
