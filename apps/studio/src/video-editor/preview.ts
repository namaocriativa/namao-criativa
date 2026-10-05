import {
  formatTimecode,
  storageUrl,
  type EditClip,
  type EditDocumentStore,
  type EditTrack,
} from "./document";
import { drawTextOverlay } from "./text-styles";

export function initPreview(opts: {
  canvas: HTMLCanvasElement;
  probeVideo: HTMLVideoElement;
  playBtn: HTMLButtonElement;
  timecodeEl: HTMLElement;
  store: EditDocumentStore;
}) {
  const { canvas, probeVideo, playBtn, timecodeEl, store } = opts;
  const ctx = canvas.getContext("2d");
  const videoCache = new Map<string, HTMLVideoElement>();
  const imageCache = new Map<string, HTMLImageElement>();
  const audioCache = new Map<string, HTMLAudioElement>();
  const seekToken = new WeakMap<HTMLVideoElement, number>();
  let raf = 0;
  let lastTs = 0;

  function getVideo(url: string): HTMLVideoElement {
    let el = videoCache.get(url);
    if (!el) {
      el = document.createElement("video");
      el.playsInline = true;
      el.preload = "auto";
      el.muted = true;
      el.src = url;
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:absolute;width:2px;height:2px;opacity:0;pointer-events:none";
      canvas.parentElement?.appendChild(el);
      videoCache.set(url, el);
    }
    return el;
  }

  function getImage(url: string): HTMLImageElement {
    let el = imageCache.get(url);
    if (!el) {
      el = new Image();
      el.crossOrigin = "anonymous";
      el.src = url;
      imageCache.set(url, el);
    }
    return el;
  }

  function getAudio(url: string): HTMLAudioElement {
    let el = audioCache.get(url);
    if (!el) {
      el = new Audio();
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.src = url;
      audioCache.set(url, el);
    }
    return el;
  }

  function drawFitted(
    source: CanvasImageSource,
    sw: number,
    sh: number,
    fit: string,
    transform?: EditClip["transform"],
  ) {
    if (!ctx) return;
    const { width: cw, height: ch } = canvas;
    let dw = cw;
    let dh = ch;
    const scale = transform?.scale ?? 1;
    if (fit === "contain" || fit === "cover") {
      const r = sw / sh;
      const cr = cw / ch;
      if (fit === "contain" ? r > cr : r < cr) {
        dw = cw;
        dh = cw / r;
      } else {
        dh = ch;
        dw = ch * r;
      }
    }
    dw *= scale;
    dh *= scale;
    const dx = (cw - dw) / 2 + (transform?.x ?? 0);
    const dy = (ch - dh) / 2 + (transform?.y ?? 0);
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  let paintingFromSeek = false;

  function seekAndDraw(
    video: HTMLVideoElement,
    localTime: number,
    clip: EditClip,
    playing: boolean,
  ) {
    const draw = () => {
      if (!ctx || video.readyState < 2) return;
      drawFitted(
        video,
        video.videoWidth || canvas.width,
        video.videoHeight || canvas.height,
        clip.transform?.fit || "contain",
        clip.transform,
      );
    };
    const target = Math.max(0, localTime);
    if (playing) {
      if (Math.abs(video.currentTime - target) > 0.25) {
        try {
          video.currentTime = target;
        } catch {
          /* ignore seek race */
        }
      }
      draw();
      return;
    }
    if (paintingFromSeek || Math.abs(video.currentTime - target) <= 0.04) {
      draw();
      return;
    }
    const token = (seekToken.get(video) ?? 0) + 1;
    seekToken.set(video, token);
    const afterSeek = () => {
      if (seekToken.get(video) !== token) return;
      paintingFromSeek = true;
      void syncMedia(store.getState().playheadMs, store.getState().playing);
      paintingFromSeek = false;
    };
    if (video.readyState < 1) {
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (seekToken.get(video) !== token) return;
          video.addEventListener("seeked", afterSeek, { once: true });
          try {
            video.currentTime = target;
          } catch {
            afterSeek();
          }
        },
        { once: true },
      );
      return;
    }
    video.addEventListener("seeked", afterSeek, { once: true });
    try {
      video.currentTime = target;
    } catch {
      draw();
    }
  }

  async function syncMedia(ms: number, playing: boolean) {
    const active = store.activeClipsAt(ms);
    const videos = active.filter(
      (a) => a.track.type === "video" || a.clip.media.kind === "video",
    );
    const overlays = active.filter((a) => a.track.type === "overlay");
    const audios = active.filter(
      (a) => a.track.type === "audio" || a.clip.media.kind === "audio",
    );

    if (!ctx) return;
    const { canvas: canvasCfg } = store.getState().document;
    const resized =
      canvas.width !== canvasCfg.width || canvas.height !== canvasCfg.height;
    if (resized) {
      canvas.width = canvasCfg.width;
      canvas.height = canvasCfg.height;
    }

    const primary = [...videos].reverse()[0];
    if (primary && primary.clip.media.kind !== "image") {
      const url = storageUrl(primary.clip.media.localPath);
      const video = getVideo(url);
      const into = Math.min(
        Math.max(0, primary.clip.durationMs - 1),
        Math.max(0, ms - primary.clip.startMs),
      );
      const localTime = (primary.clip.inMs + into) / 1000;
      video.muted = true;
      if (playing && video.paused) void video.play().catch(() => undefined);
      if (!playing && !video.paused) video.pause();
      if (
        !playing &&
        !paintingFromSeek &&
        video.readyState >= 1 &&
        Math.abs(video.currentTime - localTime) > 0.04
      ) {
        seekAndDraw(video, localTime, primary.clip, playing);
        return;
      }
    }

    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (primary) {
      const url = storageUrl(primary.clip.media.localPath);
      if (primary.clip.media.kind === "image") {
        const img = getImage(url);
        if (img.complete) {
          drawFitted(
            img,
            img.naturalWidth || canvas.width,
            img.naturalHeight || canvas.height,
            primary.clip.transform?.fit || "contain",
            primary.clip.transform,
          );
        }
      } else {
        const video = getVideo(url);
        const into = Math.min(
          Math.max(0, primary.clip.durationMs - 1),
          Math.max(0, ms - primary.clip.startMs),
        );
        const localTime = (primary.clip.inMs + into) / 1000;
        seekAndDraw(video, localTime, primary.clip, playing);
      }
    }

    for (const overlay of overlays) {
      if (overlay.clip.media.kind === "text" && overlay.clip.text) {
        drawTextOverlay(
          ctx,
          canvas.width,
          canvas.height,
          overlay.clip.text,
          overlay.clip.transform,
        );
        continue;
      }
      if (overlay.clip.media.kind !== "image") continue;
      const img = getImage(storageUrl(overlay.clip.media.localPath));
      if (img.complete) {
        drawFitted(
          img,
          img.naturalWidth || 200,
          img.naturalHeight || 200,
          overlay.clip.transform?.fit || "contain",
          overlay.clip.transform,
        );
      }
    }

    // Audio mix (HTMLAudioElement)
    const wanted = new Set<string>();
    for (const a of audios) {
      if (a.track.muted || a.clip.muted) continue;
      const url = storageUrl(a.clip.media.localPath);
      wanted.add(url);
      const audio = getAudio(url);
      const localTime = (a.clip.inMs + (ms - a.clip.startMs)) / 1000;
      audio.volume = Math.max(0, Math.min(1, a.clip.volume));
      if (Math.abs(audio.currentTime - localTime) > 0.2) {
        try {
          audio.currentTime = Math.max(0, localTime);
        } catch {
          /* ignore */
        }
      }
      if (playing && audio.paused) void audio.play().catch(() => undefined);
      if (!playing && !audio.paused) audio.pause();
    }
    // Also play audio from video clips when not muted on video track
    for (const v of videos) {
      if (v.track.type !== "video") continue;
      if (v.track.muted || v.clip.muted || v.clip.media.kind !== "video") continue;
      const url = storageUrl(v.clip.media.localPath);
      // use separate audio element from same src for volume control
      const audioUrl = `${url}#audio`;
      wanted.add(audioUrl);
      let audio = audioCache.get(audioUrl);
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        audioCache.set(audioUrl, audio);
      }
      const localTime = (v.clip.inMs + (ms - v.clip.startMs)) / 1000;
      audio.volume = Math.max(0, Math.min(1, v.clip.volume));
      if (Math.abs(audio.currentTime - localTime) > 0.2) {
        try {
          audio.currentTime = Math.max(0, localTime);
        } catch {
          /* ignore */
        }
      }
      if (playing && audio.paused) void audio.play().catch(() => undefined);
      if (!playing && !audio.paused) audio.pause();
    }
    for (const [url, audio] of audioCache) {
      if (!wanted.has(url) && !audio.paused) audio.pause();
    }

    void probeVideo;
  }

  function tick(ts: number) {
    const state = store.getState();
    if (state.playing) {
      if (lastTs) {
        const delta = ts - lastTs;
        const next = state.playheadMs + delta;
        if (next >= state.document.durationMs) {
          store.setPlayhead(state.document.durationMs);
          store.setPlaying(false);
        } else {
          store.setPlayhead(next);
        }
      }
      lastTs = ts;
      raf = requestAnimationFrame(tick);
    } else {
      lastTs = 0;
    }
  }

  function refresh() {
    const state = store.getState();
    playBtn.textContent = state.playing ? "Pause" : "Play";
    timecodeEl.textContent = `${formatTimecode(state.playheadMs)} / ${formatTimecode(state.document.durationMs)}`;
    void syncMedia(state.playheadMs, state.playing);
    if (state.playing && !raf) {
      lastTs = 0;
      raf = requestAnimationFrame(tick);
    }
    if (!state.playing && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastTs = 0;
    }
  }

  playBtn.addEventListener("click", () => {
    const state = store.getState();
    if (state.document.durationMs <= 0) return;
    if (state.playing) store.setPlaying(false);
    else {
      if (state.playheadMs >= state.document.durationMs) store.setPlayhead(0);
      store.setPlaying(true);
    }
  });

  store.subscribe(refresh);
  store.subscribePlayhead(refresh);
  refresh();

  return {
    refresh,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      for (const v of videoCache.values()) {
        v.pause();
        v.src = "";
      }
      for (const a of audioCache.values()) {
        a.pause();
        a.src = "";
      }
      videoCache.clear();
      audioCache.clear();
      imageCache.clear();
    },
  };
}

export type { EditTrack };
