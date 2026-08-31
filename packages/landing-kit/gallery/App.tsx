import { useMemo, useState } from 'react';
import { COMPONENT_IDS, familyOf, type ComponentId } from '../src/ids';
import { ReducedMotionProvider } from '../src/lib/motion/use-reduced-motion';
import { SAMPLE_PROPS } from '../src/registry/examples';
import { getComponentMeta } from '../src/catalog/variants';
import { capabilitiesFor } from '../src/registry/component-capabilities';
import { LandingPage } from '../src/renderer';
import { resolveTheme } from '../src/theme/resolve';
import type { PageSpec } from '../src/spec/page-spec';

const FAMILIES = [...new Set(COMPONENT_IDS.map((id) => familyOf(id)))];

function specFor(id: ComponentId, dark: boolean): PageSpec {
  const theme = resolveTheme({
    style: 'premium',
    paletteId: dark ? 'ink-gold' : 'slate-teal',
    fontPairId: 'fraunces-source',
    animation: 'cinematic',
  });
  return {
    version: 1,
    theme,
    sections: [
      {
        id: 'preview',
        type: familyOf(id) === 'hero' ? 'hero' : 'custom',
        component: id,
        purpose: 'gallery',
        props: SAMPLE_PROPS[id] || {},
      },
    ],
    overlays: [],
  };
}

export default function App() {
  const [family, setFamily] = useState<(typeof FAMILIES)[number] | 'all'>('hero');
  const [selected, setSelected] = useState<ComponentId>('hero.cinematic');
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [reduced, setReduced] = useState(false);

  const ids = COMPONENT_IDS.filter(
    (id) => family === 'all' || familyOf(id) === family,
  );
  const meta = getComponentMeta(selected);
  const caps = capabilitiesFor(selected);
  const spec = useMemo(() => specFor(selected, dark), [selected, dark]);
  const themeCss = resolveTheme(spec.theme).cssVariables;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <style>{themeCss}</style>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <strong>Component Gallery</strong>
        <select
          value={family}
          onChange={(event) => {
            const next = event.target.value as typeof family;
            setFamily(next);
            const first = COMPONENT_IDS.find(
              (id) => next === 'all' || familyOf(id) === next,
            );
            if (first) setSelected(first);
          }}
        >
          <option value="all">todas</option>
          {FAMILIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value as ComponentId)}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={mobile}
            onChange={(event) => setMobile(event.target.checked)}
          />{' '}
          mobile
        </label>
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => setDark(event.target.checked)}
          />{' '}
          dark
        </label>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(event) => setReduced(event.target.checked)}
          />{' '}
          reduced motion
        </label>
      </header>
      <aside className="border-b border-zinc-200 bg-white px-4 py-3 text-sm">
        <p>
          <strong>{meta?.name || selected}</strong> · {caps.runtime} ·{' '}
          {caps.capabilities.join(', ') || '—'}
        </p>
        <p className="opacity-80">{meta?.description}</p>
        {caps.mobile ? <p>Mobile: {caps.mobile}</p> : null}
        {caps.performance ? <p>Perf: {caps.performance}</p> : null}
      </aside>
      <div className="flex justify-center bg-zinc-200 p-6">
        <div
          className="overflow-hidden bg-[color:var(--paper)] shadow-xl"
          style={{
            width: mobile ? 390 : 'min(1200px, 100%)',
            minHeight: 640,
          }}
        >
          <ReducedMotionProvider value={reduced}>
            <LandingPage spec={spec} />
          </ReducedMotionProvider>
        </div>
      </div>
    </div>
  );
}
