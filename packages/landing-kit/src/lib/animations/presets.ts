import type { Transition, Variants } from 'motion/react';

export const cinematicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const cinematicTransition: Transition = {
  duration: 0.8,
  ease: cinematicEase,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: cinematicTransition },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: cinematicTransition },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: cinematicTransition },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(12px)' },
  show: { opacity: 1, filter: 'blur(0px)', transition: cinematicTransition },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: cinematicTransition },
};

export const reveal: Variants = {
  hidden: { opacity: 0, y: 16, clipPath: 'inset(0 0 100% 0)' },
  show: {
    opacity: 1,
    y: 0,
    clipPath: 'inset(0 0 0% 0)',
    transition: cinematicTransition,
  },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};

export const float: Variants = {
  hidden: { y: 0 },
  show: {
    y: [-6, 6, -6],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const spring = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 22,
};

export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

export function variantsForMotion(reduced: boolean, preset: Variants): Variants {
  return reduced ? reducedFade : preset;
}
