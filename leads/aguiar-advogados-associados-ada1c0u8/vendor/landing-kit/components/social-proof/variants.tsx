import type {
  SocialProofLogosProps,
  SocialProofNumbersProps,
} from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

export function SocialProofLogos({
  id,
  props,
}: {
  id: string;
  props: SocialProofLogosProps;
}) {
  if (!props.logos.length) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title} />
      <div className="lk-logos">
        {props.logos.map((logo) => (
          <img key={logo.src} src={logo.src} alt={logo.alt || ''} />
        ))}
      </div>
    </SectionFrame>
  );
}

export function SocialProofNumbers({
  id,
  props,
}: {
  id: string;
  props: SocialProofNumbersProps;
}) {
  if (props.rating == null) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title || 'Avaliações'} />
      <p className="lk-proof__score">
        {props.rating}
        {props.reviewCount != null ? (
          <span> · {props.reviewCount} avaliações</span>
        ) : null}
      </p>
      {props.caption ? <p className="lk-lead">{props.caption}</p> : null}
    </SectionFrame>
  );
}
