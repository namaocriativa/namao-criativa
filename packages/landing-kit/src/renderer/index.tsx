import type { FeatureSpec, OverlaySpec, PageSpec } from '../spec/page-spec';
import { renderSection } from '../components/registry';
import { AiChatWidget } from '../features/ai-chat/AiChat';
import {
  AI_CHAT_FEATURE_ID,
  AI_CONCIERGE_FEATURE_ID,
  MAP_FEATURE_ID,
} from '../features/catalog';
import { GoogleMapEmbed } from '../features/map/GoogleMapEmbed';
import { enableMotion } from '../lib/motion/policy';
import { useReducedMotion } from '../lib/motion/use-reduced-motion';
import { LenisProvider } from '../lib/scroll/lenis-provider';

export { ReducedMotionProvider } from '../lib/motion/use-reduced-motion';

function Overlay({ spec }: { spec: OverlaySpec }) {
  if (!spec.html) return null;
  return <div dangerouslySetInnerHTML={{ __html: spec.html }} />;
}

function FeatureIslands({ features }: { features: FeatureSpec[] }) {
  const concierge = features.find((item) => item.id === AI_CONCIERGE_FEATURE_ID);
  const chat = features.find((item) => item.id === AI_CHAT_FEATURE_ID);
  if (concierge) {
    return (
      <AiChatWidget
        props={{
          ...(chat?.props || {}),
          ...concierge.props,
          variant: 'concierge',
        }}
      />
    );
  }
  if (chat) return <AiChatWidget props={chat.props} />;
  return null;
}

export function LandingPage({ spec }: { spec: PageSpec }) {
  const reduced = useReducedMotion();
  const smooth = enableMotion({
    reducedMotion: reduced,
    animation: spec.theme.animation,
  });
  const mapFeature = spec.features?.find((item) => item.id === MAP_FEATURE_ID);
  const mapSectionId = String(mapFeature?.props?.sectionId || '');

  return (
    <LenisProvider enabled={smooth}>
      <div
        className={`lk-page lk-style-${spec.theme.style} lk-density-${spec.theme.density}`}
      >
        {spec.sections.map((section) => {
          const node = renderSection(section);
          if (!mapFeature || mapSectionId !== section.id) return node;
          return (
            <div key={section.id} className="lk-map-host">
              {node}
              <GoogleMapEmbed props={mapFeature.props} />
            </div>
          );
        })}
        {spec.overlays?.map((overlay, index) => (
          <Overlay key={`${overlay.component}-${index}`} spec={overlay} />
        ))}
        {spec.features?.length ? (
          <FeatureIslands features={spec.features} />
        ) : null}
      </div>
    </LenisProvider>
  );
}
