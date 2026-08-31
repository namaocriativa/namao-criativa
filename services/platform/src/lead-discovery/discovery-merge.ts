import { namePlaceDedupeKey } from '../enrichment/lead-dedupe';
import { DiscoveryResult } from '../providers/provider.types';
import { haversineMeters, MERGE_DISTANCE_METERS } from './discovery-geo';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  const ta = na.split(/\s+/).slice(0, 2).join(' ');
  const tb = nb.split(/\s+/).slice(0, 2).join(' ');
  return ta.length >= 4 && ta === tb;
}

function withSources(item: DiscoveryResult, fallback: string): DiscoveryResult {
  const sources =
    item.sources?.length
      ? [...item.sources]
      : item.source
        ? [item.source]
        : [fallback];
  return {
    ...item,
    source: item.source || fallback,
    sources,
  };
}

function isMatch(
  google: DiscoveryResult,
  osm: DiscoveryResult,
  place: { city: string; state: string },
): boolean {
  const googleKey = namePlaceDedupeKey({
    name: google.name,
    city: google.city || place.city,
    state: google.state || place.state,
  });
  const osmKey = namePlaceDedupeKey({
    name: osm.name,
    city: osm.city || place.city,
    state: osm.state || place.state,
  });
  const sameName = Boolean(googleKey && osmKey && googleKey === osmKey);
  const dist = haversineMeters(google, osm);

  if (sameName) {
    if (dist == null) return true;
    return dist <= MERGE_DISTANCE_METERS;
  }

  return (
    dist != null &&
    dist <= MERGE_DISTANCE_METERS &&
    namesSimilar(google.name, osm.name)
  );
}

function mergeFields(
  google: DiscoveryResult,
  osm: DiscoveryResult,
): DiscoveryResult {
  const sources = new Set([
    ...(google.sources ?? [google.source || 'google']),
    ...(osm.sources ?? [osm.source || 'search']),
  ]);
  return {
    ...google,
    website: google.website || osm.website || null,
    phone: google.phone || osm.phone || null,
    instagram: google.instagram || osm.instagram || null,
    address: google.address || osm.address || null,
    source: google.source || 'google',
    sources: [...sources],
  };
}

export function mergeDiscoveryResults(
  google: DiscoveryResult[],
  osm: DiscoveryResult[],
  place: { city: string; state: string },
): DiscoveryResult[] {
  const merged = google.map((item) => withSources(item, 'google'));
  const usedOsm = new Set<number>();

  for (let i = 0; i < osm.length; i += 1) {
    const osmItem = osm[i];
    let bestIndex = -1;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let j = 0; j < merged.length; j += 1) {
      if (!isMatch(merged[j], osmItem, place)) continue;
      const dist = haversineMeters(merged[j], osmItem);
      const score = dist ?? 0;
      if (bestIndex < 0 || score < bestDist) {
        bestIndex = j;
        bestDist = score;
      }
    }

    if (bestIndex >= 0) {
      merged[bestIndex] = mergeFields(merged[bestIndex], osmItem);
      usedOsm.add(i);
    }
  }

  for (let i = 0; i < osm.length; i += 1) {
    if (usedOsm.has(i)) continue;
    merged.push(withSources(osm[i], 'search'));
  }

  return merged;
}
