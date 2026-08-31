import {
  extensionForImage,
  UPLOAD_MIME_TYPES,
} from './storage.service';

describe('extensionForImage', () => {
  it('usa o MIME quando conhecido', () => {
    expect(extensionForImage('image/png', 'foto.bin')).toBe('.png');
    expect(extensionForImage('image/jpeg', 'x')).toBe('.jpg');
    expect(extensionForImage('image/webp', 'x')).toBe('.webp');
  });

  it('cai no nome do arquivo quando o MIME é desconhecido', () => {
    expect(extensionForImage(null, 'logo.WEBP')).toBe('.webp');
    expect(extensionForImage('application/octet-stream', 'a.gif')).toBe(
      '.gif',
    );
  });

  it('aceita URL com extensão', () => {
    expect(
      extensionForImage(null, 'https://cdn.example.com/img/hero.jpeg?w=800'),
    ).toBe('.jpg');
  });
});

describe('UPLOAD_MIME_TYPES', () => {
  it('não inclui svg no upload manual', () => {
    expect(UPLOAD_MIME_TYPES).not.toContain('image/svg+xml');
  });
});
