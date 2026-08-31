'use client';

import { motion } from 'motion/react';
import { fadeUp, float, variantsForMotion } from '../../../lib/animations/presets';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { ProductHeroProps } from '../../../spec/page-spec';
import { PremiumCopy } from './copy';

function DeviceFrame({
  src,
  device,
}: {
  src?: string;
  device: ProductHeroProps['device'];
}) {
  const isPhone = device === 'phone';
  return (
    <div
      className={
        isPhone
          ? 'mx-auto w-[min(280px,70vw)] rounded-[2rem] border-8 border-[color:var(--ink)] bg-[color:var(--ink)] shadow-2xl'
          : 'overflow-hidden rounded-[1.1rem] border border-white/20 bg-[color:var(--ink)] shadow-2xl'
      }
    >
      {!isPhone ? (
        <div className="flex gap-1.5 bg-black/40 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
      ) : null}
      {src ? (
        <img
          src={src}
          alt=""
          className={isPhone ? 'aspect-[9/19] w-full object-cover' : 'aspect-[16/10] w-full object-cover'}
        />
      ) : (
        <div className={isPhone ? 'aspect-[9/19] bg-[color:var(--surface)]' : 'aspect-[16/10] bg-[color:var(--surface)]'} />
      )}
    </div>
  );
}

export function ProductHero({
  id,
  props,
}: {
  id: string;
  props: ProductHeroProps;
}) {
  const reduced = useReducedMotion();
  const shot = props.screenshot || props.image;

  return (
    <section
      id={id}
      className="lk-section relative overflow-hidden"
      aria-labelledby={`${id}-title`}
    >
      <div className="lk-container grid items-center gap-12 md:grid-cols-2">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
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
        <motion.div
          className="relative"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={variantsForMotion(reduced, reduced ? fadeUp : float)}
        >
          <div
            aria-hidden
            className="absolute -left-6 top-8 h-24 w-24 rounded-full blur-2xl"
            style={{ background: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
          />
          <DeviceFrame src={shot} device={props.device} />
        </motion.div>
      </div>
    </section>
  );
}

export default ProductHero;
