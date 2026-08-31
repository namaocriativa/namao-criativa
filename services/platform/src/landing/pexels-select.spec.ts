import { buildLeadBrief } from './lead-brief';
import {
  filterPexelsCandidates,
  heuristicPexelsQuery,
  heroStockVideoRequested,
  parsePexelsPick,
  parsePexelsQuery,
  pickDownloadFile,
  type PexelsVideo,
} from './pexels-select';

const hdFile = {
  id: 1,
  quality: 'hd',
  file_type: 'video/mp4',
  width: 1920,
  height: 1080,
  link: 'https://example.com/hero.mp4',
};

function sampleVideo(overrides: Partial<PexelsVideo> = {}): PexelsVideo {
  return {
    id: 42,
    width: 1920,
    height: 1080,
    duration: 12,
    url: 'https://www.pexels.com/video/42/',
    image: 'https://images.pexels.com/videos/42.jpg',
    user: { name: 'Ana', url: 'https://www.pexels.com/@ana' },
    video_files: [hdFile],
    ...overrides,
  };
}

describe('pexels-select', () => {
  it('heroStockVideoRequested só olha a seção hero', () => {
    expect(
      heroStockVideoRequested([
        { type: 'gallery', stockVideo: true },
        { type: 'hero', stockVideo: true },
      ]),
    ).toBe(true);
    expect(
      heroStockVideoRequested([{ type: 'hero', stockVideo: false }]),
    ).toBe(false);
  });

  it('parseia query e descarta pontuação', () => {
    const parsed = parsePexelsQuery({
      query: 'law office interior!!!',
      queryAlt: 'lawyer desk',
      reason: 'nicho',
    });
    expect(parsed.query).toBe('law office interior');
    expect(parsed.queryAlt).toBe('lawyer desk');
  });

  it('rejeita query vazia', () => {
    expect(() => parsePexelsQuery({ query: '!!!' })).toThrow(/vazia/);
  });

  it('fallback heurístico usa categoria', () => {
    const brief = buildLeadBrief({
      id: 'x',
      name: 'Firma',
      category: 'Advocacia',
      services: ['Consultoria'],
    });
    const choice = heuristicPexelsQuery(brief);
    expect(choice.query.toLowerCase()).toContain('advocacia');
    expect(choice.queryAlt.toLowerCase()).toContain('consultoria');
  });

  it('filtra duração, portrait e 4K', () => {
    const candidates = filterPexelsCandidates([
      sampleVideo({ duration: 3 }),
      sampleVideo({ id: 2, width: 1080, height: 1920 }),
      sampleVideo({
        id: 3,
        video_files: [
          {
            quality: 'hd',
            file_type: 'video/mp4',
            width: 3840,
            height: 2160,
            link: 'https://example.com/4k.mp4',
          },
        ],
      }),
      sampleVideo({ id: 99, duration: 14 }),
    ]);
    expect(candidates.map((item) => item.id)).toEqual([99]);
    expect(candidates[0].downloadUrl).toBe('https://example.com/hero.mp4');
  });

  it('pickDownloadFile prefere 1920 e ignora 4K', () => {
    expect(
      pickDownloadFile([
        {
          file_type: 'video/mp4',
          width: 3840,
          height: 2160,
          link: 'https://example.com/4k.mp4',
        },
        {
          file_type: 'video/mp4',
          width: 1280,
          height: 720,
          link: 'https://example.com/hd.mp4',
        },
        {
          file_type: 'video/mp4',
          width: 1920,
          height: 1080,
          link: 'https://example.com/fhd.mp4',
        },
      ])?.link,
    ).toBe('https://example.com/fhd.mp4');
  });

  it('parsePexelsPick exige id da lista', () => {
    expect(parsePexelsPick({ videoId: 99, reason: 'ok' }, [99]).videoId).toBe(
      99,
    );
    expect(() => parsePexelsPick({ videoId: 1 }, [99])).toThrow(/inválido/);
  });
});
