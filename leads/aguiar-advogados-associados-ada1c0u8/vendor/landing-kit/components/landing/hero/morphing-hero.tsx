'use client';

import { AnimatePresence, motion, type TargetAndTransition } from 'motion/react';
import { useEffect, useState } from 'react';
import { fadeUp, variantsForMotion } from '../../../lib/animations/presets';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { MorphingHeroProps } from '../../../spec/page-spec';
import { CtaButton } from '../../primitives';

const MODES: Record<
  NonNullable<MorphingHeroProps['mode']>,
  {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    exit: TargetAndTransition;
  }
> = {
  morph: {
    initial: { opacity: 0, filter: 'blur(10px)', scale: 0.96 },
    animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
    exit: { opacity: 0, filter: 'blur(8px)', scale: 1.04 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -28 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(16px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(16px)' },
  },
  scale: {
    initial: { opacity: 0, scale: 0.86 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.08 },
  },
  stagger: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  },
};

export function MorphingHero({
  id,
  props,
}: {
  id: string;
  props: MorphingHeroProps;
}) {
  const reduced = useReducedMotion();
  const words = props.words.length ? props.words : [props.headline || ''];
  const [index, setIndex] = useState(0);
  const mode = MODES[props.mode || 'fade'];

  useEffect(() => {
    if (reduced || words.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [reduced, words.length]);

  const word = words[reduced ? 0 : index] || words[0];

  return (
    <section
      id={id}
      className="relative flex min-h-[88svh] items-center overflow-hidden"
      aria-labelledby={`${id}-title`}
    >
      {props.image ? (
        <img
          src={props.image}
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
        />
      ) : null}
      <div className="lk-container">
        <motion.div
          initial="hidden"
          animate="show"
          variants={variantsForMotion(reduced, fadeUp)}
        >
          {props.eyebrow ? (
            <p className="lk-eyebrow">{props.eyebrow}</p>
          ) : null}
          {props.headline ? (
            <p className="mb-3 text-lg opacity-80">{props.headline}</p>
          ) : null}
          <h1
            id={`${id}-title`}
            className="font-[family-name:var(--font-display)] text-[clamp(2.6rem,8vw,5rem)] leading-[1.02] tracking-[-0.04em]"
          >
            {reduced ? (
              word
            ) : (
              <span className="relative inline-grid">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={word}
                    initial={mode.initial}
                    animate={mode.animate}
                    exit={mode.exit}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="col-start-1 row-start-1"
                  >
                    {word}
                  </motion.span>
                </AnimatePresence>
              </span>
            )}
          </h1>
          {props.description ? (
            <p className="lk-lead mt-5 max-w-xl">{props.description}</p>
          ) : null}
          {props.cta ? (
            <div className="mt-6">
              <CtaButton cta={props.cta} />
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

export default MorphingHero;
