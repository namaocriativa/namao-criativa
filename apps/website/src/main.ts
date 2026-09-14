import './chrome';
import './invite-request';
import { initHeroMedia, whenIdleReady } from './hero-media';
import { mountWebsiteChat } from './chat/mount';

async function bootScenes() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const heroCanvas = document.getElementById('hero-webgl');
  const hero = document.querySelector<HTMLElement>('.hero');
  const offerCanvas = document.getElementById('offer-webgl');
  const offerStage = document.querySelector<HTMLElement>('.offer-stage');

  const [{ mountHeroScene }, { mountOfferScene }] = await Promise.all([
    import('./three/heroScene'),
    import('./three/offerScene'),
  ]);

  if (heroCanvas instanceof HTMLCanvasElement && hero) {
    mountHeroScene(heroCanvas, hero);
  }

  if (offerCanvas instanceof HTMLCanvasElement && offerStage) {
    mountOfferScene(offerCanvas, offerStage);
  }
}

initHeroMedia();
whenIdleReady(() => {
  void bootScenes();
});
mountWebsiteChat();
