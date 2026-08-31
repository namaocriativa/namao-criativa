import type { Cta } from '../../../spec/page-spec';
import { CtaButton } from '../../primitives';

export function PremiumCopy({
  eyebrow,
  headline,
  description,
  cta,
  className = '',
  headlineId,
}: {
  eyebrow?: string;
  headline?: string;
  description?: string;
  cta?: Cta | null;
  className?: string;
  headlineId?: string;
}) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="lk-eyebrow mb-3 tracking-[0.2em] text-sm uppercase opacity-80">
          {eyebrow}
        </p>
      ) : null}
      {headline ? (
        <h1
          id={headlineId}
          className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,7vw,4.6rem)] leading-[1.05] tracking-[-0.03em]"
        >
          {headline}
        </h1>
      ) : null}
      {description ? (
        <p className="mt-4 max-w-xl text-lg opacity-90">{description}</p>
      ) : null}
      {cta ? (
        <div className="mt-6">
          <CtaButton cta={cta} />
        </div>
      ) : null}
    </div>
  );
}
