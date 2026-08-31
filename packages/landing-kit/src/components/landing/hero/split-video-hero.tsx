'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp, variantsForMotion } from '../../../lib/animations/presets';
import { useInView } from '../../../lib/motion/use-in-view';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import type { SplitVideoHeroProps } from '../../../spec/page-spec';
import { CtaButton } from '../../primitives';
import { HeroMedia } from './media';

const ICONS: Record<string, ReactNode> = {
  heart: (
    <path
      d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  building: (
    <>
      <path
        d="M4 20V7.5L12 4l8 3.5V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 20v-6h6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.5 18.5c.6-2.8 2.6-4.3 4.5-4.3s3.9 1.5 4.5 4.3M14 14.4c1.5.1 3.1 1.3 3.7 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  star: (
    <path
      d="m12 3.5 2.2 4.6 5.1.6-3.7 3.5.9 5.1L12 15.2 7.5 17.8l.9-5.1-3.7-3.5 5.1-.6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
};

const ICON_ORDER = ['heart', 'building', 'people', 'star'] as const;

function HighlightIcon({ name }: { name?: string }) {
  const key = name && ICONS[name] ? name : 'star';
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="lk-split-video__icon">
      {ICONS[key]}
    </svg>
  );
}

export function SplitVideoHero({
  id,
  props,
}: {
  id: string;
  props: SplitVideoHeroProps;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLElement>(0.08);

  return (
    <section
      ref={ref}
      id={id}
      data-lk-hero
      className="lk-split-video relative isolate flex min-h-[100svh] flex-col overflow-hidden text-white"
      aria-labelledby={`${id}-title`}
    >
      <div className="absolute inset-0 -z-10">
        <HeroMedia
          image={props.image}
          video={props.video}
          inView={inView}
          reduced={reduced}
          className="h-full w-full object-cover"
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-[1]"
        style={{
          background: `linear-gradient(90deg, rgba(12,9,8,${(props.overlayOpacity ?? 0.58) + 0.12}) 0%, rgba(12,9,8,${(props.overlayOpacity ?? 0.58) * 0.55}) 48%, rgba(12,9,8,0.28) 100%), linear-gradient(to top, rgba(12,9,8,0.72) 0%, transparent 42%)`,
        }}
      />

      <div className="lk-container relative z-[1] flex flex-1 flex-col justify-center py-28 md:py-32">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,380px)] lg:gap-16">
          <motion.div
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
            variants={variantsForMotion(reduced, fadeUp)}
            className="max-w-2xl"
          >
            {props.eyebrow ? (
              <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.22em] opacity-80">
                {props.eyebrow}
              </p>
            ) : null}
            <h1
              id={`${id}-title`}
              className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,6.4vw,4.6rem)] leading-[1.05] tracking-[-0.03em]"
            >
              {props.headline}
            </h1>
            {props.description ? (
              <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90 md:text-lg">
                {props.description}
              </p>
            ) : null}
            {props.cta ? (
              <div className="mt-8">
                <CtaButton cta={props.cta} className="lk-btn lk-btn--ghost lk-btn--pill" />
              </div>
            ) : null}
          </motion.div>

          <motion.figure
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
            variants={variantsForMotion(reduced, fadeUp)}
            className="lk-split-video__portrait relative mx-auto w-full max-w-[340px] overflow-hidden lg:mx-0 lg:justify-self-end"
          >
            <HeroMedia
              image={props.portraitImage || props.image}
              video={props.portraitVideo}
              inView={inView}
              reduced={reduced}
              className="lk-split-video__portrait-media h-full w-full object-cover"
            />
            {props.portraitCaption || props.portraitSubcaption ? (
              <figcaption className="lk-split-video__caption">
                {props.portraitCaption ? <strong>{props.portraitCaption}</strong> : null}
                {props.portraitSubcaption ? <span>{props.portraitSubcaption}</span> : null}
              </figcaption>
            ) : null}
          </motion.figure>
        </div>
      </div>

      {props.highlights?.length ? (
        <ul className="lk-split-video__bar relative z-[1]">
          {props.highlights.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <HighlightIcon name={item.icon || ICON_ORDER[index % ICON_ORDER.length]} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default SplitVideoHero;
