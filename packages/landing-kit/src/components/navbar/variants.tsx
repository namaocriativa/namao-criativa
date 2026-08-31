'use client';

import { useEffect, useState } from 'react';
import type { NavbarProps } from '../../spec/page-spec';
import { Brand, CtaButton, NavLinks } from '../primitives';

function NavbarBase({
  id,
  variant,
  props,
}: {
  id: string;
  variant: 'minimal' | 'centered' | 'premium';
  props: NavbarProps;
}) {
  return (
    <header className={`lk-navbar lk-navbar--${variant}`} id={id}>
      <div className="lk-container lk-navbar__inner">
        <Brand name={props.brand} logo={props.logo} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <NavLinks items={props.nav} />
          <CtaButton cta={props.cta} />
        </div>
      </div>
    </header>
  );
}

export function NavbarMinimal({ id, props }: { id: string; props: NavbarProps }) {
  return <NavbarBase id={id} variant="minimal" props={props} />;
}

export function NavbarCentered({ id, props }: { id: string; props: NavbarProps }) {
  return <NavbarBase id={id} variant="centered" props={props} />;
}

export function NavbarPremium({ id, props }: { id: string; props: NavbarProps }) {
  return <NavbarBase id={id} variant="premium" props={props} />;
}

export function NavbarMarketing({ id, props }: { id: string; props: NavbarProps }) {
  return (
    <header className="lk-navbar lk-navbar--marketing" id={id}>
      <div className="lk-container lk-navbar__inner lk-navbar__inner--marketing">
        <Brand name={props.brand} logo={props.logo} />
        <NavLinks items={props.nav} />
        <div className="lk-navbar__actions">
          <CtaButton cta={props.cta} className="lk-btn lk-btn--invert" />
        </div>
      </div>
    </header>
  );
}

function isWhatsappHref(href?: string | null) {
  return /wa\.me|whatsapp/i.test(href || '');
}

export function NavbarOverlay({ id, props }: { id: string; props: NavbarProps }) {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const hero =
      document.querySelector<HTMLElement>('[data-lk-hero]') ||
      document.querySelector<HTMLElement>('section#hero');
    if (!hero || typeof IntersectionObserver === 'undefined') {
      setOverHero(Boolean(hero));
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOverHero(entry.isIntersecting && entry.intersectionRatio > 0.08);
      },
      { threshold: [0, 0.08, 0.2, 0.4] },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const whatsapp = isWhatsappHref(props.cta?.href);
  const ctaClass = whatsapp
    ? 'lk-btn lk-btn--whatsapp lk-btn--pill'
    : overHero
      ? 'lk-btn lk-btn--ghost lk-btn--pill'
      : 'lk-btn lk-btn--pill';

  return (
    <header
      className={`lk-navbar lk-navbar--overlay ${overHero ? 'is-over-hero' : 'is-past-hero'}`}
      id={id}
    >
      <div className="lk-container lk-navbar__inner lk-navbar__inner--marketing">
        <Brand name={props.brand} logo={props.logo} />
        <NavLinks items={props.nav} />
        <div className="lk-navbar__actions">
          <CtaButton cta={props.cta} className={ctaClass} />
        </div>
      </div>
    </header>
  );
}
