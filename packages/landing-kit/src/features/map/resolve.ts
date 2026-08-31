export const MAP_FEATURE_ID = 'features.map';

const MAP_SECTION_LABEL = /^(maps?|mapa)$/i;

export type MapSectionRef = {
  id: string;
  title?: string;
  type?: string;
};

export type MapLocationBrief = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
};

export function isMapSectionLabel(value?: string | null): boolean {
  return MAP_SECTION_LABEL.test(String(value || '').trim());
}

export function mapTargetSections<T extends { type?: string }>(sections: T[]): T[] {
  const content = sections.filter(
    (item) => item.type !== 'header' && item.type !== 'footer',
  );
  return content.length ? content : sections;
}

export function resolveMapSectionId(
  sections: MapSectionRef[],
  preferred?: string | null,
): string | null {
  if (!sections.length) return null;
  const targets = mapTargetSections(sections);
  const pool = targets.length ? targets : sections;
  const ids = new Set(pool.map((item) => item.id));
  const wanted = String(preferred || '').trim();
  if (wanted && ids.has(wanted)) return wanted;

  const named = pool.find(
    (item) => isMapSectionLabel(item.title) || isMapSectionLabel(item.id),
  );
  if (named) return named.id;

  const contact = pool.find(
    (item) => item.type === 'contact' || item.id === 'contact',
  );
  if (contact) return contact.id;

  return pool[0]?.id ?? sections[0]?.id ?? null;
}

export function mapEmbedQuery(brief: MapLocationBrief): string | null {
  const lat = brief.latitude;
  const lng = brief.longitude;
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `${lat},${lng}`;
  }
  const address = String(brief.address || '').trim();
  return address || null;
}

export function googleMapsEmbedSrc(query: string, zoom = 15): string {
  const params = new URLSearchParams({
    q: query,
    z: String(zoom),
    output: 'embed',
  });
  return `https://www.google.com/maps?${params.toString()}`;
}

export function fillMapFeatureProps(
  features: Array<{ id: string; props?: Record<string, unknown> }>,
  brief: MapLocationBrief,
  sections: MapSectionRef[],
): Array<{ id: string; props: Record<string, unknown> }> {
  const query = mapEmbedQuery(brief);
  const address = String(brief.address || '').trim();
  return features.flatMap((feature) => {
    if (feature.id !== MAP_FEATURE_ID) {
      return [{ id: feature.id, props: { ...(feature.props || {}) } }];
    }
    if (!query) return [];
    const sectionId = resolveMapSectionId(
      sections,
      String(feature.props?.sectionId || ''),
    );
    if (!sectionId) return [];
    return [
      {
        id: feature.id,
        props: {
          ...(feature.props || {}),
          sectionId,
          query,
          ...(address ? { address } : {}),
        },
      },
    ];
  });
}
