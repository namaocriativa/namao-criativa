import type { LayoutSectionProps, LayoutSplitProps } from '../../../spec/page-spec';

function alignClass(align?: string) {
  if (align === 'center') return 'text-center items-center';
  if (align === 'end') return 'text-right items-end';
  return 'text-left items-start';
}

export function LayoutSection({
  id,
  props,
  fullscreen = false,
  contained = true,
}: {
  id: string;
  props: LayoutSectionProps;
  fullscreen?: boolean;
  contained?: boolean;
}) {
  const minH = props.minHeight || (fullscreen ? '100vh' : undefined);
  const inner = (
    <div className={`flex flex-col ${alignClass(props.align)}`}>
      {props.title ? <h2 className="lk-title">{props.title}</h2> : null}
      {props.body ? <p className="lk-lead">{props.body}</p> : null}
    </div>
  );
  return (
    <section
      id={id}
      className="lk-section"
      style={{
        background: props.background || undefined,
        padding: props.padding || undefined,
        minHeight: minH,
      }}
    >
      {contained && props.container !== false ? (
        <div className="lk-container">{inner}</div>
      ) : (
        inner
      )}
    </section>
  );
}

export function LayoutContainer({
  id,
  props,
}: {
  id: string;
  props: LayoutSectionProps;
}) {
  return <LayoutSection id={id} props={props} contained />;
}

export function LayoutFullscreen({
  id,
  props,
}: {
  id: string;
  props: LayoutSectionProps;
}) {
  return <LayoutSection id={id} props={{ ...props, minHeight: props.minHeight || '100vh' }} fullscreen />;
}

export function LayoutSplit({ id, props }: { id: string; props: LayoutSplitProps }) {
  const cols =
    props.ratio === '40-60'
      ? 'md:grid-cols-[0.8fr_1.2fr]'
      : props.ratio === '60-40'
        ? 'md:grid-cols-[1.2fr_0.8fr]'
        : 'md:grid-cols-2';
  return (
    <section className="lk-section" id={id}>
      <div className={`lk-container grid gap-8 ${cols} items-center`}>
        <div>
          {props.leftTitle ? <h2 className="lk-title">{props.leftTitle}</h2> : null}
          {props.leftBody ? <p className="lk-lead">{props.leftBody}</p> : null}
        </div>
        <div>
          {props.image ? (
            <img src={props.image} alt="" className="w-full rounded-[var(--radius)] object-cover" />
          ) : null}
          {props.rightTitle ? <h3 className="lk-title">{props.rightTitle}</h3> : null}
          {props.rightBody ? <p className="lk-lead">{props.rightBody}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default LayoutSection;
