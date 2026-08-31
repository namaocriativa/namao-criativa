import type { CtaBandProps } from '../../spec/page-spec';
import { CtaButton, Heading } from '../primitives';

export function CtaBanner({ id, props }: { id: string; props: CtaBandProps }) {
  if (!props.cta) return null;
  return (
    <section className="lk-section lk-cta" id={id}>
      <div className="lk-container">
        <Heading title={props.title} lead={props.subtitle} />
        <CtaButton cta={props.cta} />
      </div>
    </section>
  );
}

export function CtaSplit({ id, props }: { id: string; props: CtaBandProps }) {
  if (!props.cta) return null;
  return (
    <section className="lk-section lk-cta" id={id}>
      <div className="lk-container lk-cta--split">
        <div>
          <Heading title={props.title} lead={props.subtitle} />
          <CtaButton cta={props.cta} />
        </div>
        {props.image ? (
          <img src={props.image} alt="" style={{ borderRadius: 'var(--radius)' }} />
        ) : null}
      </div>
    </section>
  );
}
