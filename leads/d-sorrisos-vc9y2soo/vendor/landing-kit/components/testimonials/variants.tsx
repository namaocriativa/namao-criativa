import type { TestimonialsProps } from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

export function TestimonialsCards({
  id,
  props,
}: {
  id: string;
  props: TestimonialsProps;
}) {
  if (props.rating == null && !props.quotes.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} />
      {props.rating != null ? (
        <p className="lk-proof__score">
          {props.rating}
          {props.reviewCount != null ? (
            <span> · {props.reviewCount} avaliações</span>
          ) : null}
        </p>
      ) : null}
      {props.quotes.length ? (
        <div className="lk-grid lk-features">
          {props.quotes.map((item) => (
            <article className="lk-card" key={item.quote}>
              <p>{item.quote}</p>
              {item.author ? <p className="lk-lead">{item.author}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}

export function TestimonialsQuotes({
  id,
  props,
}: {
  id: string;
  props: TestimonialsProps;
}) {
  const quote = props.quotes[0];
  if (!quote && props.rating == null) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title} />
      {quote ? (
        <>
          <p className="lk-quote">“{quote.quote}”</p>
          {quote.author ? <p className="lk-lead">{quote.author}</p> : null}
        </>
      ) : props.rating != null ? (
        <p className="lk-proof__score">
          {props.rating}
          {props.reviewCount != null ? (
            <span> · {props.reviewCount} avaliações</span>
          ) : null}
        </p>
      ) : null}
    </SectionFrame>
  );
}
