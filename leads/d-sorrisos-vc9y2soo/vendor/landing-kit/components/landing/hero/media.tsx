import {
  useEffect,
  useRef,
  type CSSProperties,
} from 'react';

export function HeroMedia({
  image,
  video,
  className,
  inView,
  reduced,
  style,
}: {
  image?: string;
  video?: string;
  className?: string;
  inView: boolean;
  reduced: boolean;
  style?: CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canPlayVideo = Boolean(video) && !reduced;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView && canPlayVideo) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [inView, canPlayVideo]);

  if (canPlayVideo) {
    return (
      <video
        ref={videoRef}
        className={className}
        style={style}
        muted
        loop
        playsInline
        preload="none"
        poster={image || undefined}
        src={inView ? video : undefined}
        aria-hidden
      />
    );
  }

  if (image) {
    return <img src={image} alt="" className={className} style={style} />;
  }

  return (
    <div
      className={className}
      style={{
        ...style,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--ink) 80%, var(--accent)), var(--accent))',
      }}
    />
  );
}
