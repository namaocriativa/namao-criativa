import type { AboutProps } from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

function ratingLine(props: AboutProps) {
  if (props.rating == null) return undefined;
  return props.reviewCount != null
    ? `Avaliação ${props.rating} · ${props.reviewCount} avaliações`
    : `Avaliação ${props.rating}`;
}

export function AboutSplit({ id, props }: { id: string; props: AboutProps }) {
  if (!props.body && props.rating == null) return null;
  return (
    <SectionFrame id={id}>
      <div className="lk-about--split">
        <div>
          <Heading title={props.title} lead={ratingLine(props)} />
          {props.body ? <p>{props.body}</p> : null}
        </div>
        {props.image ? <img src={props.image} alt="" /> : null}
      </div>
    </SectionFrame>
  );
}

export function AboutEditorial({ id, props }: { id: string; props: AboutProps }) {
  if (!props.body && props.rating == null) return null;
  return (
    <SectionFrame id={id} className="lk-about--editorial">
      <Heading title={props.title} lead={ratingLine(props)} />
      {props.body ? <p>{props.body}</p> : null}
    </SectionFrame>
  );
}
