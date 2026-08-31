import { googleMapsEmbedSrc } from './resolve';

function asText(value: unknown): string {
  return String(value || '').trim();
}

export function GoogleMapEmbed({
  props = {},
}: {
  props?: Record<string, unknown>;
}) {
  const query = asText(props.query) || asText(props.address);
  if (!query) return null;
  const title = asText(props.title) || asText(props.address) || 'Mapa';

  return (
    <div className="lk-map-embed">
      <div className="lk-container">
        <iframe
          className="lk-map-embed__frame"
          title={title}
          src={googleMapsEmbedSrc(query)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
}
