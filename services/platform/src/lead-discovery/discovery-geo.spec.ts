import {
  bboxFromCenterRadius,
  bboxFromNominatimBox,
  haversineMeters,
  parseBbox,
  radiusKmFromBbox,
} from './discovery-geo';

describe('discovery-geo', () => {
  it('monta bbox a partir do centro e raio', () => {
    const bbox = bboxFromCenterRadius(-23.55, -46.63, 5);
    const parsed = parseBbox(bbox);
    expect(parsed).not.toBeNull();
    const latSpan = parsed!.north - parsed!.south;
    const lngSpan = parsed!.east - parsed!.west;
    expect(latSpan).toBeCloseTo(5 / 111.32 * 2, 2);
    expect(lngSpan).toBeGreaterThan(0);
    expect(parsed!.south).toBeLessThan(-23.55);
    expect(parsed!.north).toBeGreaterThan(-23.55);
  });

  it('converte bounding box do Nominatim para Overpass', () => {
    expect(
      bboxFromNominatimBox(['-23.6', '-23.5', '-46.7', '-46.5']),
    ).toBe('-23.6,-46.7,-23.5,-46.5');
  });

  it('estima raio a partir do bbox', () => {
    const bbox = bboxFromCenterRadius(-23.55, -46.63, 2);
    expect(radiusKmFromBbox(bbox)).toBeGreaterThan(1.5);
    expect(radiusKmFromBbox(bbox)).toBeLessThan(3);
  });

  it('calcula distância haversine em metros', () => {
    const a = { latitude: -23.55, longitude: -46.63 };
    const near = { latitude: -23.5504, longitude: -46.63 };
    const far = { latitude: -23.56, longitude: -46.64 };
    expect(haversineMeters(a, near)).toBeLessThan(80);
    expect(haversineMeters(a, far)).toBeGreaterThan(80);
    expect(haversineMeters(a, { latitude: null, longitude: -46.63 })).toBeNull();
  });
});
