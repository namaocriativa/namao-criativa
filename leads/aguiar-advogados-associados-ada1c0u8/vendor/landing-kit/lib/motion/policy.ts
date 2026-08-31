export function enableMotion(opts: {
  reducedMotion: boolean;
  animation?: 'cinematic' | 'none' | string;
}): boolean {
  return !opts.reducedMotion && opts.animation !== 'none';
}
