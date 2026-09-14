function whenIdle(fn: () => void) {
  const idle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof idle === 'function') {
    idle(() => fn(), { timeout: 2500 });
    return;
  }
  setTimeout(fn, 900);
}

export function initHeroMedia() {
  const video = document.querySelector<HTMLVideoElement>('.hero-video');
  if (!video) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 700px)').matches) return;

  whenIdle(() => {
    if (video.dataset.ready === '1') return;
    video.dataset.ready = '1';
    const webm = video.dataset.webm;
    const mp4 = video.dataset.mp4;
    if (webm) {
      const source = document.createElement('source');
      source.src = webm;
      source.type = 'video/webm';
      video.append(source);
    }
    if (mp4) {
      const source = document.createElement('source');
      source.src = mp4;
      source.type = 'video/mp4';
      video.append(source);
    }
    video.preload = 'metadata';
    void video.play().catch(() => undefined);
  });
}

export function whenIdleReady(fn: () => void) {
  whenIdle(fn);
}
