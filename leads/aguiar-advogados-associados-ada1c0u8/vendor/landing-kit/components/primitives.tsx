import type { ReactNode } from 'react';
import type { Cta, NavItem } from '../spec/page-spec';

export function CtaButton({
  cta,
  className = 'lk-btn',
}: {
  cta?: Cta | null;
  className?: string;
}) {
  if (!cta?.href || !cta.label) return null;
  return (
    <a className={className} href={cta.href}>
      {cta.label}
    </a>
  );
}

export function Brand({
  name,
  logo,
  href = '#hero',
}: {
  name: string;
  logo?: string;
  href?: string;
}) {
  return (
    <a className="lk-brand" href={href}>
      {logo ? <img src={logo} alt="" /> : null}
      <span>{name}</span>
    </a>
  );
}

export function NavLinks({ items }: { items: NavItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="lk-nav" aria-label="Principal">
      {items.map((item) => (
        <a key={`${item.href}-${item.label}`} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function SectionFrame({
  id,
  surface,
  className = '',
  children,
}: {
  id: string;
  surface?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = [
    'lk-section',
    surface ? 'lk-section--surface' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={cls} id={id}>
      <div className="lk-container">{children}</div>
    </section>
  );
}

export function Heading({
  title,
  lead,
  as: Tag = 'h2',
}: {
  title?: string;
  lead?: string;
  as?: 'h1' | 'h2';
}) {
  return (
    <>
      {title ? <Tag className="lk-title">{title}</Tag> : null}
      {lead ? <p className="lk-lead">{lead}</p> : null}
    </>
  );
}
