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
