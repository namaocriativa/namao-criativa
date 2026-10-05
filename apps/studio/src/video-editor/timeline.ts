import {
  formatTimecode,
  type EditDocumentStore,
  type EditTrack,
} from "./document";

const PX_PER_MS = 0.04;
const MIN_CLIP_MS = 200;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initTimeline(opts: {
  root: HTMLElement;
  store: EditDocumentStore;
}) {
  const { root, store } = opts;

  function render() {
    const { document: doc, selection, playheadMs } = store.getState();
    const width = Math.max(800, doc.durationMs * PX_PER_MS + 200);
    const marks: string[] = [];
    const step = doc.durationMs > 60000 ? 10000 : 5000;
    for (let t = 0; t <= Math.max(doc.durationMs, 10000); t += step) {
      marks.push(
        `<span class="ve-ruler-mark" style="left:${t * PX_PER_MS}px">${formatTimecode(t)}</span>`,
      );
    }

    root.innerHTML = `
      <div class="ve-timeline-scroll">
        <div class="ve-timeline-inner" style="width:${width}px">
          <div class="ve-ruler">
            ${marks.join("")}
            <div class="ve-playhead" style="left:${playheadMs * PX_PER_MS}px"></div>
          </div>
          ${doc.tracks.map((track) => renderTrack(track, selection)).join("")}
        </div>
      </div>
    `;

    bindInteractions();
    syncPlayhead();
  }

  function syncPlayhead() {
    const el = root.querySelector(".ve-playhead") as HTMLElement | null;
    if (!el) return;
    el.style.marginLeft = "0px";
    el.style.left = `${store.getState().playheadMs * PX_PER_MS}px`;
  }

  function timeFromPointer(event: { clientX: number }): number {
    const ruler = root.querySelector(".ve-ruler") as HTMLElement | null;
    if (!ruler) return 0;
    const rect = ruler.getBoundingClientRect();
    const width = ruler.clientWidth || rect.width || 1;
    const x = ((event.clientX - rect.left) / (rect.width || 1)) * width;
    return Math.max(0, Math.round(x / PX_PER_MS));
  }

  function seekFromPointer(event: { clientX: number }) {
    if (store.getState().playing) store.setPlaying(false);
    store.setPlayhead(timeFromPointer(event));
  }

  function bindInteractions() {
    const scroll = root.querySelector(".ve-timeline-scroll");
    scroll?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".ve-clip") || target.closest(".ve-trim") || target.closest(".ve-ruler")) {
        return;
      }
      seekFromPointer(e as MouseEvent);
    });

    const ruler = root.querySelector(".ve-ruler");
    ruler?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      seekFromPointer(e as MouseEvent);
      const seek = (event: Event) => {
        if ("clientX" in event) seekFromPointer(event as MouseEvent);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", seek);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", seek);
      window.addEventListener("pointerup", onUp);
    });

    root.querySelectorAll<HTMLElement>(".ve-clip").forEach((el) => {
      const trackId = el.dataset.trackId!;
      const clipId = el.dataset.clipId!;
      el.addEventListener("mousedown", (e) => {
        if ((e.target as HTMLElement).closest(".ve-trim")) return;
        e.preventDefault();
        store.select(trackId, clipId);
        const startX = e.clientX;
        const clip = store.findClipAt(trackId, clipId)?.clip;
        if (!clip) return;
        const origStart = clip.startMs;
        store.beginHistoryCheckpoint();
        const onMove = (ev: MouseEvent) => {
          const delta = (ev.clientX - startX) / PX_PER_MS;
          store.updateClip(
            trackId,
            clipId,
            {
              startMs: Math.max(0, Math.round(origStart + delta)),
            },
            { history: false },
          );
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });

    root.querySelectorAll<HTMLElement>(".ve-trim").forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clipEl = handle.closest(".ve-clip") as HTMLElement;
        const trackId = clipEl.dataset.trackId!;
        const clipId = clipEl.dataset.clipId!;
        const side = handle.dataset.side as "in" | "out";
        store.select(trackId, clipId);
        const clip = store.findClipAt(trackId, clipId)?.clip;
        if (!clip) return;
        const startX = e.clientX;
        const origIn = clip.inMs;
        const origOut = clip.outMs;
        const origStart = clip.startMs;
        store.beginHistoryCheckpoint();
        const onMove = (ev: MouseEvent) => {
          const delta = (ev.clientX - startX) / PX_PER_MS;
          if (side === "in") {
            const nextIn = Math.max(
              0,
              Math.min(origOut - MIN_CLIP_MS, Math.round(origIn + delta)),
            );
            const shift = nextIn - origIn;
            store.updateClip(
              trackId,
              clipId,
              {
                inMs: nextIn,
                outMs: origOut,
                startMs: Math.max(0, origStart + shift),
                durationMs: origOut - nextIn,
              },
              { history: false },
            );
          } else {
            const nextOut = Math.max(
              origIn + MIN_CLIP_MS,
              Math.round(origOut + delta),
            );
            store.updateClip(
              trackId,
              clipId,
              {
                outMs: nextOut,
                durationMs: nextOut - origIn,
              },
              { history: false },
            );
          }
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });
  }

  function renderTrack(
    track: EditTrack,
    selection: { trackId: string | null; clipId: string | null },
  ): string {
    return `
      <div class="ve-track" data-track-id="${escapeHtml(track.id)}">
        <div class="ve-track-label">
          <strong>${escapeHtml(track.type)}</strong>
          ${track.muted ? "<span>mudo</span>" : ""}
        </div>
        <div class="ve-track-lane">
          ${track.clips
            .map((clip) => {
              const selected =
                selection.trackId === track.id && selection.clipId === clip.id;
              return `
              <div class="ve-clip ${selected ? "selected" : ""}" data-track-id="${escapeHtml(track.id)}" data-clip-id="${escapeHtml(clip.id)}"
                style="left:${clip.startMs * PX_PER_MS}px;width:${Math.max(8, clip.durationMs * PX_PER_MS)}px">
                <span class="ve-trim ve-trim-in" data-side="in"></span>
                <span class="ve-clip-label">${escapeHtml(clip.media.label || clip.media.kind)}</span>
                <span class="ve-trim ve-trim-out" data-side="out"></span>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  store.subscribe(render);
  store.subscribePlayhead(syncPlayhead);
  render();
  return { render };
}
