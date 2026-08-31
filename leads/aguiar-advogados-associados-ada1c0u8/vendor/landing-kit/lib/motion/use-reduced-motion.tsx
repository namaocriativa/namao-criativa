import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const ReducedMotionContext = createContext<boolean | undefined>(undefined);

export function ReducedMotionProvider({
  value,
  children,
}: {
  value?: boolean;
  children: ReactNode;
}) {
  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(forced?: boolean): boolean {
  const fromContext = useContext(ReducedMotionContext);
  const [reduced, setReduced] = useState(
    () => forced ?? fromContext ?? prefersReducedMotion(),
  );

  useEffect(() => {
    if (forced != null) {
      setReduced(forced);
      return;
    }
    if (fromContext != null) {
      setReduced(fromContext);
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [forced, fromContext]);

  return reduced;
}
