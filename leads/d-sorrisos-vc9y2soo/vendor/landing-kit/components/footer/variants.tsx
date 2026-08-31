import type { FooterProps } from '../../spec/page-spec';
import { Brand, NavLinks } from '../primitives';

export function FooterMinimal({ id, props }: { id: string; props: FooterProps }) {
  return (
    <footer className="lk-footer" id={id}>
      <div className="lk-container">
        <p>
          {props.brand}
          {props.location ? ` · ${props.location}` : ''}
        </p>
      </div>
    </footer>
  );
}

export function FooterPremium({ id, props }: { id: string; props: FooterProps }) {
  return (
    <footer className="lk-footer lk-footer--premium" id={id}>
      <div className="lk-container lk-footer__inner">
        <Brand name={props.brand} href="#hero" />
        <NavLinks items={props.nav} />
        <div>
          {props.links.map((link) => (
            <p key={link.href}>
              <a href={link.href}>{link.label}</a>
            </p>
          ))}
          {props.location ? <p>{props.location}</p> : null}
        </div>
      </div>
    </footer>
  );
}
