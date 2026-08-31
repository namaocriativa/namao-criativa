'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { fadeUp, variantsForMotion } from '../../../lib/animations/presets';
import { useGsapParallax } from '../../../lib/gsap/scroll';
import { useCoarsePointer } from '../../../lib/motion/use-coarse-pointer';
import { useInView } from '../../../lib/motion/use-in-view';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { CinematicHeroProps } from '../../../spec/page-spec';
import { PremiumCopy } from './copy';
import { HeroMedia } from './media';

export function CinematicHero({
  id,
  props,
}: {
  id: string;
  props: CinematicHeroProps;
}) {
  const reduced = useReducedMotion();
  const coarse = useCoarsePointer();
  const { ref, inView } = useInView<HTMLElement>();
  const mediaRef = useGsapParallax<HTMLDivElement>({
    disabled: reduced || !inView,
    speed: 0.2,
  });
  const mouseOn = Boolean(props.mouseParallax) && !reduced && !coarse;
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mouseOn) return;
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 24;
      const y = (event.clientY / window.innerHeight - 0.5) * 16;
      setOffset({ x, y });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [mouseOn]);

  return (
    <section
      ref={ref}
      id={id}
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden text-[color:var(--paper)]"
      aria-labelledby={`${id}-title`}
    >
      <div
        ref={mediaRef}
        className="absolute inset-[-8%] -z-10"
      >
        <div
          className="h-full w-full"
          style={
            mouseOn
              ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
              : undefined
          }
        >
          <HeroMedia
            image={props.image}
            video={props.video}
            inView={inView}
            reduced={reduced}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-[1]"
        style={{
          background: `linear-gradient(to top, color-mix(in srgb, var(--ink) ${Math.round((props.overlayOpacity ?? 0.45) * 100)}%, transparent), transparent 55%)`,
        }}
      />
      <div className="lk-container relative z-[1] pb-16 pt-32">
        <motion.div
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={variantsForMotion(reduced, fadeUp)}
        >
          <PremiumCopy
            eyebrow={props.eyebrow}
            headline={props.headline}
            description={props.description}
            cta={props.cta}
            headlineId={`${id}-title`}
          />
        </motion.div>
      </div>
    </section>
  );
}

export default CinematicHero;
