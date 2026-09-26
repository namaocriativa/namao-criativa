import { compactIgCorpus } from './ig-corpus';

describe('compactIgCorpus', () => {
  it('conta tipos, hashtags e CTAs das captions', () => {
    const corpus = compactIgCorpus(
      [
        {
          id: '1',
          mediaType: 'IMAGE',
          url: 'https://x/1.jpg',
          caption: 'Agende no WhatsApp #estetica https://wa.me/11 comenta EUQUERO',
          timestamp: '2026-09-20T10:00:00.000Z',
        },
        {
          id: '2',
          mediaType: 'VIDEO',
          url: 'https://x/2.jpg',
          caption: 'Bastidor da clínica #estetica salva esse post',
          timestamp: '2026-09-13T10:00:00.000Z',
        },
      ],
      { username: 'loja.ana', windowDays: 30 },
    );
    expect(corpus.username).toBe('loja.ana');
    expect(corpus.postCount).toBe(2);
    expect(corpus.mix.image).toBe(1);
    expect(corpus.mix.video).toBe(1);
    expect(corpus.hashtags.some((item) => item.tag === '#estetica')).toBe(true);
    expect(corpus.ctas.whatsapp).toBe(1);
    expect(corpus.ctas.comment).toBe(1);
    expect(corpus.ctas.save).toBe(1);
    expect(corpus.posts[0].captionPreview).toContain('WhatsApp');
    expect(corpus.themes.some((item) => item.tag === 'clinica' || item.tag === 'bastidor')).toBe(
      true,
    );
  });
});
