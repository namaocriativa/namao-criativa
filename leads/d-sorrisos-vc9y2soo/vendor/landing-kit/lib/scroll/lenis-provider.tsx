import { useEffect, type ReactNode } from 'react';
import { useReducedMotion } from '../motion/use-reduced-motion';

export function LenisProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) return;
    let raf = 0;
    let instance: { raf: (time: number) => void; destroy: () => void } | null =
      null;
    let cancelled = false;

    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({ lerp: 0.08 });
      instance = lenis;
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      instance?.destroy();
    };
  }, [enabled, reduced]);

  return children;
}
