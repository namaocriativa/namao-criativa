import { useEffect, useRef } from 'react';

type ParallaxOpts = {
  speed?: number;
  disabled?: boolean;
};

let pluginRegistered = false;

export async function ensureScrollTrigger() {
  const gsap = (await import('gsap')).default;
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  if (!pluginRegistered) {
    gsap.registerPlugin(ScrollTrigger);
    pluginRegistered = true;
  }
  return { gsap, ScrollTrigger };
}

export function useGsapParallax<T extends HTMLElement>(opts: ParallaxOpts = {}) {
  const ref = useRef<T | null>(null);
  const { speed = 0.18, disabled = false } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    let ctx: { revert: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      const { gsap, ScrollTrigger } = await ensureScrollTrigger();
      if (cancelled || !ref.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { yPercent: -speed * 40 },
          {
            yPercent: speed * 40,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      }, el);
      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [disabled, speed]);

  return ref;
}
