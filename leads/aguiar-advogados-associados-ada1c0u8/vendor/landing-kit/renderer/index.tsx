import type { OverlaySpec, PageSpec } from '../spec/page-spec';
import { renderSection } from '../components/registry';
import { enableMotion } from '../lib/motion/policy';
import { useReducedMotion } from '../lib/motion/use-reduced-motion';
import { LenisProvider } from '../lib/scroll/lenis-provider';

export { ReducedMotionProvider } from '../lib/motion/use-reduced-motion';

function Overlay({ spec }: { spec: OverlaySpec }) {
  if (!spec.html) return null;
  return <div dangerouslySetInnerHTML={{ __html: spec.html }} />;
}

export function LandingPage({ spec }: { spec: PageSpec }) {
  const reduced = useReducedMotion();
  const smooth = enableMotion({
    reducedMotion: reduced,
    animation: spec.theme.animation,
  });

  return (
    <LenisProvider enabled={smooth}>
      <div
        className={`lk-page lk-style-${spec.theme.style} lk-density-${spec.theme.density}`}
      >
        {spec.sections.map((section) => renderSection(section))}
        {spec.overlays?.map((overlay, index) => (
          <Overlay key={`${overlay.component}-${index}`} spec={overlay} />
        ))}
      </div>
    </LenisProvider>
  );
}
