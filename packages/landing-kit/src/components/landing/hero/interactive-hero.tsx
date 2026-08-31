'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { fadeUp, variantsForMotion } from '../../../lib/animations/presets';
import { useCoarsePointer } from '../../../lib/motion/use-coarse-pointer';
import { useMagnetic } from '../../../lib/motion/use-magnetic';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { InteractiveHeroProps } from '../../../spec/page-spec';
import { CtaButton } from '../../primitives';

export function InteractiveHero({
  id,
  props,
}: {
  id: string;
  props: InteractiveHeroProps;
}) {
  const reduced = useReducedMotion();
  const coarse = useCoarsePointer();
  const mouseOn = !reduced && !coarse;
  const magnetic = useMagnetic<HTMLDivElement>({
    disabled: !props.magnetic || !mouseOn,
    strength: 0.22,
  });
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [layer, setLayer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mouseOn) return;
    const onMove = (event: PointerEvent) => {
      setCursor({ x: event.clientX, y: event.clientY });
      setLayer({
        x: (event.clientX / window.innerWidth - 0.5) * 40,
        y: (event.clientY / window.innerHeight - 0.5) * 28,
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [mouseOn]);

  return (
    <section
      id={id}
      className="relative min-h-[100svh] overflow-hidden"
      aria-labelledby={`${id}-title`}
    >
      {props.image ? (
        <img
          src={props.image}
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
          style={
            mouseOn
              ? { transform: `translate3d(${layer.x * 0.35}px, ${layer.y * 0.35}px, 0) scale(1.08)` }
              : undefined
          }
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 40%, transparent), transparent 42%), var(--ink)',
          }}
        />
      )}
      {mouseOn ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 mix-blend-difference"
          style={{ left: cursor.x, top: cursor.y }}
        />
      ) : null}
      <div className="lk-container relative flex min-h-[100svh] items-center">
        <motion.div
          initial="hidden"
          animate="show"
          variants={variantsForMotion(reduced, fadeUp)}
          style={
            mouseOn
              ? { transform: `translate3d(${layer.x * 0.15}px, ${layer.y * 0.15}px, 0)` }
              : undefined
          }
        >
          {props.eyebrow ? <p className="lk-eyebrow">{props.eyebrow}</p> : null}
          <h1
            id={`${id}-title`}
            className="max-w-3xl font-[family-name:var(--font-display)] text-[clamp(2.5rem,7vw,4.8rem)] leading-[1.04] tracking-[-0.04em]"
          >
            {props.headline}
          </h1>
          {props.description ? (
            <p className="lk-lead mt-4 max-w-xl">{props.description}</p>
          ) : null}
          {props.cta ? (
            <div ref={magnetic} className="mt-8 inline-block will-change-transform">
              <CtaButton cta={props.cta} />
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

export default InteractiveHero;
