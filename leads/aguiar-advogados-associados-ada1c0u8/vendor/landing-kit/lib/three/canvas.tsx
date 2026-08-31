import { lazy, Suspense, type ReactNode } from 'react';

const ParticlesScene = lazy(() => import('./particles-scene'));

export function ThreeCanvasFallback({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ImmersiveParticles({
  enabled,
  fallback,
}: {
  enabled: boolean;
  fallback: ReactNode;
}) {
  if (!enabled) return <>{fallback}</>;
  return (
    <Suspense fallback={fallback}>
      <ParticlesScene />
    </Suspense>
  );
}
