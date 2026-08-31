import { grammarViolations } from '../catalog/grammar';
import { parseComponentProps, parsePageSpec } from './page-spec';

describe('page spec + grammar', () => {
  it('aceita um spec mínimo válido', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'premium',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'header',
          type: 'header',
          component: 'navbar.minimal',
          props: { brand: 'Firma' },
        },
        {
          id: 'hero',
          type: 'hero',
          component: 'hero.gradient',
          props: { headline: 'Firma' },
        },
        {
          id: 'footer',
          type: 'footer',
          component: 'footer.minimal',
          props: { brand: 'Firma' },
        },
      ],
    });
    expect(spec.sections).toHaveLength(3);
    const issues = grammarViolations(spec, {
      hasPhotos: false,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: true,
      hasLogo: false,
    });
    expect(issues).toEqual([]);
  });

  it('rejeita dois heros e gallery sem fotos', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'modern',
        paletteId: 'navy-coral',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'header',
          type: 'header',
          component: 'navbar.minimal',
          props: { brand: 'X' },
        },
        {
          id: 'hero',
          type: 'hero',
          component: 'hero.centered',
          props: { headline: 'X' },
        },
        {
          id: 'hero2',
          type: 'hero',
          component: 'hero.gradient',
          props: { headline: 'Y' },
        },
        {
          id: 'gallery',
          type: 'gallery',
          component: 'gallery.grid',
          props: { images: ['/images/a.jpg'] },
        },
        {
          id: 'footer',
          type: 'footer',
          component: 'footer.minimal',
          props: { brand: 'X' },
        },
      ],
    });
    const issues = grammarViolations(spec, {
      hasPhotos: false,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: false,
      hasLogo: false,
    });
    expect(issues.some((item) => item.includes('hero'))).toBe(true);
    expect(issues.some((item) => item.includes('gallery'))).toBe(true);
  });

  it('aceita alias camelCase de hero premium', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'premium',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          component: 'morphingHero',
          props: { words: ['um', 'dois'], headline: 'Marca' },
        },
      ],
    });
    expect(spec.sections[0].component).toBe('hero.morphing');
  });

  it('aceita alias camelCase das variantes de marketing', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'premium',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          component: 'marketingHero',
          props: { headline: 'Aurora', footnote: 'Atendimento em São Paulo.' },
        },
      ],
    });
    expect(spec.sections[0].component).toBe('hero.marketing');
  });

  it('content.block aceita body e items null', () => {
    const props = parseComponentProps('content.block', {
      title: 'Bloco',
      body: null,
      items: null,
    });
    expect(props.body).toBe('');
    expect(props.items).toEqual([]);
  });
});
