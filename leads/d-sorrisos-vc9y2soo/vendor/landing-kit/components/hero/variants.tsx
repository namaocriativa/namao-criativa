import type { HeroProps, MarketingHeroProps } from '../../spec/page-spec';
import { CtaButton } from '../primitives';

function HeroCopy({ props }: { props: HeroProps }) {
  return (
    <div className="lk-hero__content">
      {props.eyebrow ? <p className="lk-eyebrow">{props.eyebrow}</p> : null}
      <h1 className="lk-hero__headline">{props.headline}</h1>
      {props.description ? (
        <p className="lk-hero__subtitle">{props.description}</p>
      ) : null}
      {props.cta ? (
        <div className="lk-hero__actions">
          <CtaButton cta={props.cta} />
        </div>
      ) : null}
    </div>
  );
}

export function HeroSplitImage({ id, props }: { id: string; props: HeroProps }) {
  return (
    <section className="lk-hero lk-hero--split" id={id}>
      <div className="lk-container">
        <HeroCopy props={props} />
      </div>
      {props.image ? (
        <img className="lk-hero__media" src={props.image} alt="" />
      ) : null}
    </section>
  );
}

export function HeroCentered({ id, props }: { id: string; props: HeroProps }) {
  return (
    <section className="lk-hero lk-hero--center" id={id}>
      <div className="lk-container">
        <HeroCopy props={props} />
        {props.image ? (
          <img className="lk-hero__media" src={props.image} alt="" />
        ) : null}
      </div>
    </section>
  );
}

export function HeroFullImage({ id, props }: { id: string; props: HeroProps }) {
  return (
    <section className="lk-hero lk-hero--full" id={id}>
      {props.image ? (
        <img className="lk-hero__media" src={props.image} alt="" />
      ) : null}
      <div className="lk-container">
        <HeroCopy props={props} />
      </div>
    </section>
  );
}

export function HeroGradient({ id, props }: { id: string; props: HeroProps }) {
  return (
    <section className="lk-hero lk-hero--gradient" id={id}>
      <div className="lk-container">
        <HeroCopy props={props} />
      </div>
    </section>
  );
}

export function HeroMarketing({
  id,
  props,
}: {
  id: string;
  props: MarketingHeroProps;
}) {
  return (
    <section className="lk-hero lk-hero--marketing" id={id}>
      <div className="lk-container">
        {props.eyebrow ? <p className="lk-eyebrow">{props.eyebrow}</p> : null}
        <h1 className="lk-hero__headline">{props.headline}</h1>
        {props.description ? (
          <p className="lk-hero__subtitle">{props.description}</p>
        ) : null}
        {props.cta ? (
          <div className="lk-hero__actions">
            <CtaButton cta={props.cta} className="lk-btn lk-btn--invert lk-btn--xl" />
          </div>
        ) : null}
        {props.footnote ? (
          <p className="lk-hero__footnote">{props.footnote}</p>
        ) : null}
      </div>
    </section>
  );
}
