import { Suspense } from 'react';
import type { ComponentId } from '../ids';
import type { SectionSpec } from '../spec/page-spec';
import { getComponent, getLazyComponent } from '../registry/landing-components';

function SectionFallback({ id }: { id: string }) {
  return (
    <section id={id} className="lk-section" aria-busy="true">
      <div className="lk-container">
        <div className="h-24 rounded-[var(--radius)] bg-[color:var(--surface)]" />
      </div>
    </section>
  );
}

export function renderSection(section: SectionSpec) {
  const entry = getComponent(section.component);
  if (!entry) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[landing-kit] ignoring unknown component: ${section.component}`,
      );
    }
    return null;
  }

  let parsed: unknown;
  try {
    parsed = entry.propsSchema.parse(section.props || {});
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[landing-kit] invalid props for ${section.component}`,
        error,
      );
    }
    return null;
  }

  if (entry.component) {
    const Cmp = entry.component;
    return <Cmp key={section.id} id={section.id} props={parsed as never} />;
  }

  const LazyCmp = getLazyComponent(section.component as ComponentId);
  if (!LazyCmp) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[landing-kit] ignoring unknown component: ${section.component}`,
      );
    }
    return null;
  }

  return (
    <Suspense
      key={section.id}
      fallback={<SectionFallback id={section.id} />}
    >
      <LazyCmp id={section.id} props={parsed as never} />
    </Suspense>
  );
}
