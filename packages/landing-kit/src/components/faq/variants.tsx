import type { FaqProps } from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

export function FaqAccordion({ id, props }: { id: string; props: FaqProps }) {
  if (!props.items.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} lead={props.subtitle} />
      <div className="lk-faq">
        {props.items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </SectionFrame>
  );
}
