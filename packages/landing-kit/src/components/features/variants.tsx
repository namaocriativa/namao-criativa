import type { FeaturesProps } from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

export function FeaturesCards({ id, props }: { id: string; props: FeaturesProps }) {
  if (!props.items.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} lead={props.subtitle} />
      <div className="lk-grid lk-features">
        {props.items.map((item) => (
          <article className="lk-card" key={item}>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}

export function FeaturesBento({ id, props }: { id: string; props: FeaturesProps }) {
  if (!props.items.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} lead={props.subtitle} />
      <div className="lk-bento">
        {props.items.map((item) => (
          <article className="lk-card" key={item}>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}

export function FeaturesAlternating({
  id,
  props,
}: {
  id: string;
  props: FeaturesProps;
}) {
  if (!props.items.length) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title} lead={props.subtitle} />
      <div className="lk-alt">
        {props.items.map((item, index) => (
          <article key={item}>
            <p className="lk-eyebrow">0{index + 1}</p>
            <h3 className="lk-title" style={{ fontSize: '1.4rem' }}>
              {item}
            </h3>
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}

export function FeaturesShowcase({
  id,
  props,
}: {
  id: string;
  props: FeaturesProps;
}) {
  if (!props.items.length) return null;
  return (
    <section className="lk-section lk-showcase" id={id}>
      <div className="lk-container">
        <Heading title={props.title} lead={props.subtitle} />
        <div className="lk-showcase__grid">
          {props.items.map((item, index) => (
            <article className="lk-showcase__card" key={item}>
              <p className="lk-eyebrow">{String(index + 1).padStart(2, '0')}</p>
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
