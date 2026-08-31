'use client';

import { motion } from 'motion/react';
import { fadeUp, slideIn, variantsForMotion } from '../../../lib/animations/presets';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { SplitHeroProps } from '../../../spec/page-spec';
import { PremiumCopy } from './copy';

export function SplitHero({ id, props }: { id: string; props: SplitHeroProps }) {
  const reduced = useReducedMotion();
  const imageLeft = props.side === 'image-left';
  const copy = (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
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
  );
  const media = props.image ? (
    <motion.img
      src={props.image}
      alt=""
      className="h-full min-h-[42vh] w-full object-cover md:min-h-[100svh]"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={variantsForMotion(reduced, slideIn)}
    />
  ) : (
    <div className="min-h-[42vh] bg-[color:var(--surface)] md:min-h-[100svh]" />
  );

  return (
    <section
      id={id}
      className="grid min-h-[100svh] items-stretch md:grid-cols-2"
      aria-labelledby={`${id}-title`}
    >
      {imageLeft ? media : <div className="flex items-center p-8 md:p-14">{copy}</div>}
      {imageLeft ? <div className="flex items-center p-8 md:p-14">{copy}</div> : media}
    </section>
  );
}

export default SplitHero;
