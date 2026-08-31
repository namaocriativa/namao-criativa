'use client';

import { useRef } from 'react';
import type { GalleryProps } from '../../spec/page-spec';
import { Heading, SectionFrame } from '../primitives';

export function GalleryGrid({ id, props }: { id: string; props: GalleryProps }) {
  if (!props.images.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} />
      <div className="lk-gallery lk-gallery--grid">
        {props.images.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" />
        ))}
      </div>
    </SectionFrame>
  );
}

export function GalleryMasonry({ id, props }: { id: string; props: GalleryProps }) {
  if (!props.images.length) return null;
  return (
    <SectionFrame id={id} surface>
      <Heading title={props.title} />
      <div className="lk-masonry">
        {props.images.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" />
        ))}
      </div>
    </SectionFrame>
  );
}

export function GalleryCarousel({ id, props }: { id: string; props: GalleryProps }) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!props.images.length) return null;

  const move = (dir: number) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * Math.min(node.clientWidth * 0.72, 420), behavior: 'smooth' });
  };

  return (
    <section className="lk-section lk-carousel" id={id}>
      <div className="lk-container">
        <div className="lk-carousel__head">
          <Heading title={props.title} />
          <div className="lk-carousel__nav">
            <button type="button" aria-label="Anterior" onClick={() => move(-1)}>
              ←
            </button>
            <button type="button" aria-label="Próximo" onClick={() => move(1)}>
              →
            </button>
          </div>
        </div>
      </div>
      <div className="lk-carousel__track" ref={scroller}>
        {props.images.map((src) => (
          <article className="lk-carousel__card" key={src}>
            <img src={src} alt="" loading="lazy" />
          </article>
        ))}
      </div>
    </section>
  );
}
