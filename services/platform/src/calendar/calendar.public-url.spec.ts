import {
  isPubliclyReachableOrigin,
  signCalendarAssetUrl,
  verifyCalendarAssetSig,
} from './calendar.public-url';

describe('calendar public asset URL', () => {
  const secret = 'test-secret';

  it('assina e valida um link temporário', () => {
    const signed = signCalendarAssetUrl({
      origin: 'https://api.example.com',
      assetId: 'asset-1',
      secret,
      now: new Date('2026-09-18T00:00:00Z'),
    });
    expect(signed.url).toContain('/public/calendar-assets/asset-1');
    expect(
      verifyCalendarAssetSig({
        assetId: 'asset-1',
        exp: signed.exp,
        sig: signed.sig,
        secret,
        now: new Date('2026-09-18T00:30:00Z'),
      }),
    ).toBe(true);
  });

  it('rejeita assinatura expirada', () => {
    const signed = signCalendarAssetUrl({
      origin: 'https://api.example.com',
      assetId: 'asset-1',
      secret,
      ttlSeconds: 10,
      now: new Date('2026-09-18T00:00:00Z'),
    });
    expect(
      verifyCalendarAssetSig({
        assetId: 'asset-1',
        exp: signed.exp,
        sig: signed.sig,
        secret,
        now: new Date('2026-09-18T00:00:20Z'),
      }),
    ).toBe(false);
  });

  it('detecta origem pública', () => {
    expect(isPubliclyReachableOrigin('https://api.namaocriativa.com.br')).toBe(
      true,
    );
    expect(isPubliclyReachableOrigin('http://localhost:4000')).toBe(false);
  });
});
