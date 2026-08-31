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
