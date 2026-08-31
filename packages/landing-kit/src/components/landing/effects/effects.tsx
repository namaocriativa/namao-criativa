import { useEffect, useRef, type ReactNode } from 'react';
import type { EffectCardProps } from '../../../spec/page-spec';
import { useGsapParallax } from '../../../lib/gsap/scroll';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';

function EffectShell({
  id,
  props,
  className,
  children,
}: {
  id: string;
  props: EffectCardProps;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`lk-section ${className || ''}`} id={id}>
      <div className="lk-container">
        {children}
        {props.title ? <h2 className="lk-title relative z-[1]">{props.title}</h2> : null}
        {props.body ? <p className="lk-lead relative z-[1]">{props.body}</p> : null}
        {props.image ? (
          <img
            src={props.image}
            alt=""
            className="relative z-[1] mt-6 w-full max-w-3xl rounded-[var(--radius)] object-cover"
          />
        ) : null}
      </div>
    </section>
  );
}

export function GlassCard({ id, props }: { id: string; props: EffectCardProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [reduced]);

  return (
    <section className="lk-section" id={id}>
      <div className="lk-container">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-[var(--radius)] border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-xl"
          style={{
            backgroundImage: reduced
              ? undefined
              : 'radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in srgb, var(--accent) 35%, transparent), transparent 55%)',
          }}
        >
          {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
          {props.body ? <p className="lk-lead">{props.body}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function GlowEffect({ id, props }: { id: string; props: EffectCardProps }) {
  return (
    <EffectShell id={id} props={props} className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--accent) 55%, transparent)' }}
      />
    </EffectShell>
  );
}

export function ParallaxEffect({ id, props }: { id: string; props: EffectCardProps }) {
  const reduced = useReducedMotion();
  const ref = useGsapParallax<HTMLImageElement>({ disabled: reduced || !props.image });
  return (
    <section className="lk-section overflow-hidden" id={id}>
      <div className="lk-container">
        {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
        {props.body ? <p className="lk-lead">{props.body}</p> : null}
        {props.image ? (
          <img
            ref={ref}
            src={props.image}
            alt=""
            className="mt-6 w-full rounded-[var(--radius)] object-cover"
          />
        ) : null}
      </div>
    </section>
  );
}

export function SpotlightEffect({ id, props }: { id: string; props: EffectCardProps }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const onMove = (event: PointerEvent) => {
      el.style.setProperty('--sx', `${event.clientX}px`);
      el.style.setProperty('--sy', `${event.clientY}px`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced]);
  return (
    <section
      ref={ref}
      id={id}
      className="lk-section relative"
      style={{
        background: reduced
          ? undefined
          : 'radial-gradient(500px circle at var(--sx, 50%) var(--sy, 30%), color-mix(in srgb, var(--accent) 28%, transparent), transparent 50%)',
      }}
    >
      <div className="lk-container">
        {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
        {props.body ? <p className="lk-lead">{props.body}</p> : null}
      </div>
    </section>
  );
}

export function NoiseOverlay({ id, props }: { id: string; props: EffectCardProps }) {
  return (
    <section className="lk-section relative" id={id}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.8%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%2780%27 height=%2780%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")',
        }}
      />
      <div className="lk-container relative">
        {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
        {props.body ? <p className="lk-lead">{props.body}</p> : null}
      </div>
    </section>
  );
}

export function ScanlineEffect({ id, props }: { id: string; props: EffectCardProps }) {
  return (
    <section className="lk-section relative" id={id}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.18) 3px, transparent 4px)',
        }}
      />
      <div className="lk-container relative">
        {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
        {props.body ? <p className="lk-lead">{props.body}</p> : null}
      </div>
    </section>
  );
}

export default GlassCard;
