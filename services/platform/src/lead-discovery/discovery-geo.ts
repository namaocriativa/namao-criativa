export const MERGE_DISTANCE_METERS = 80;

export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Overpass / discovery bbox: south,west,north,east */
export function bboxFromCenterRadius(
  latitude: number,
  longitude: number,
  radiusKm: number,
): string {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const r = Math.max(0.1, Number(radiusKm) || 5);
  const dLat = r / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = r / (111.32 * Math.max(0.01, Math.abs(cosLat)));
  const south = lat - dLat;
  const north = lat + dLat;
  const west = lng - dLng;
  const east = lng + dLng;
  return `${south},${west},${north},${east}`;
}

export function parseBbox(bbox: string): BBox | null {
  const parts = bbox.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  const [south, west, north, east] = parts;
  return { south, west, north, east };
}

export function bboxFromNominatimBox(
  box: [string, string, string, string],
): string | null {
  const [south, north, west, east] = box.map(Number);
  if ([south, north, west, east].some((n) => Number.isNaN(n))) {
    return null;
  }
  return `${south},${west},${north},${east}`;
}

export function bboxCenter(
  bbox: string,
): { latitude: number; longitude: number } | null {
  const parsed = parseBbox(bbox);
  if (!parsed) return null;
  return {
    latitude: (parsed.south + parsed.north) / 2,
    longitude: (parsed.west + parsed.east) / 2,
  };
}

export function radiusKmFromBbox(bbox: string): number {
  const parsed = parseBbox(bbox);
  if (!parsed) return 5;
  const midLat = (parsed.south + parsed.north) / 2;
  const latKm = ((parsed.north - parsed.south) / 2) * 111.32;
  const lngKm =
    ((parsed.east - parsed.west) / 2) *
    111.32 *
    Math.max(0.01, Math.abs(Math.cos((midLat * Math.PI) / 180)));
  const padded = Math.max(latKm, lngKm) * 1.1;
  return Math.min(30, Math.max(0.5, padded));
}

export function haversineMeters(
  a: { latitude?: number | null; longitude?: number | null },
  b: { latitude?: number | null; longitude?: number | null },
): number | null {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
