import type { ContactProps } from '../../spec/page-spec';
import { CtaButton, Heading, SectionFrame } from '../primitives';

export function ContactForm({ id, props }: { id: string; props: ContactProps }) {
  if (!props.links.length && !props.address && !props.cta) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title} lead={props.subtitle} />
      <ul className="lk-contact-list">
        {props.links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
        {props.address ? <li>{props.address}</li> : null}
      </ul>
      {props.cta ? (
        <p style={{ marginTop: '1.25rem' }}>
          <CtaButton cta={props.cta} />
        </p>
      ) : null}
    </SectionFrame>
  );
}
