import type { ContentBlockProps } from '../../spec/page-spec';
import { CtaButton, Heading, SectionFrame } from '../primitives';

export function ContentBlock({
  id,
  props,
}: {
  id: string;
  props: ContentBlockProps;
}) {
  if (!props.title && !props.body && !props.items.length) return null;
  return (
    <SectionFrame id={id}>
      <Heading title={props.title} />
      {props.body ? <p>{props.body}</p> : null}
      {props.items.length ? (
        <ul>
          {props.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {props.cta ? (
        <p style={{ marginTop: '1.25rem' }}>
          <CtaButton cta={props.cta} />
        </p>
      ) : null}
    </SectionFrame>
  );
}
