'use client';

import { Component, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { fadeUp, variantsForMotion } from '../../../lib/animations/presets';
import { ImmersiveParticles } from '../../../lib/three/canvas';
import { useCoarsePointer } from '../../../lib/motion/use-coarse-pointer';
import { useInView } from '../../../lib/motion/use-in-view';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { ImmersiveHeroProps } from '../../../spec/page-spec';
import { PremiumCopy } from './copy';
import { HeroMedia } from './media';

class ThreeBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ImmersiveHero({
  id,
  props,
}: {
  id: string;
  props: ImmersiveHeroProps;
}) {
  const reduced = useReducedMotion();
  const coarse = useCoarsePointer();
  const { ref, inView } = useInView<HTMLElement>();
  const mediaFallback = (
    <HeroMedia
      image={props.image}
      video={props.video}
      inView={inView}
      reduced={reduced}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
  const useParticles =
    props.mode === 'particles' && !reduced && !coarse && inView;

  return (
    <section
      ref={ref}
      id={id}
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[color:var(--ink)] text-[color:var(--paper)]"
      aria-labelledby={`${id}-title`}
    >
      <div className="absolute inset-0 -z-10">
        <ThreeBoundary fallback={mediaFallback}>
          <ImmersiveParticles enabled={useParticles} fallback={mediaFallback} />
        </ThreeBoundary>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)] via-transparent to-transparent"
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

export default ImmersiveHero;
