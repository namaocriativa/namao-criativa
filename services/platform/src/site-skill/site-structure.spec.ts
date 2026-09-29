import {
  parseApprovedBrief,
  parseSiteStructure,
  parseStoredBrief,
} from './site-structure';

const knownGaps = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    note: 'Não há WhatsApp no cadastro. Não inventar número.',
  },
];

describe('parseSiteStructure', () => {
  it('mantém seções e preserva a lacuna de contato', () => {
    const parsed = parseSiteStructure(
      {
        sections: [
          {
            id: 'hero',
            kind: 'hero',
            title: 'Hero',
            purpose: 'Proposta',
            facts: ['name'],
            cta: '',
          },
          {
            id: 'sobre',
            kind: 'about',
            title: 'Sobre',
            purpose: 'Apresentação',
            cta: 'Fale conosco',
          },
        ],
        gaps: [
          { key: 'price', label: 'Preço', note: 'Preço não identificado.' },
        ],
      },
      { objective: 'leads', objectiveNote: '', knownGaps },
    );
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[1].kind).toBe('about');
    expect(parsed.gaps.map((gap) => gap.key)).toEqual(['whatsapp', 'price']);
    expect(parsed.gaps[0].confidence).toBe('identified');
    expect(parsed.gaps[1].confidence).toBe('suggested');
  });

  it('recusa estrutura curta e objetivo desconhecido no briefing aprovado', () => {
    expect(() =>
      parseSiteStructure(
        { sections: [{ title: 'Só uma', purpose: 'Pouco', kind: 'hero' }] },
        { objective: 'present', objectiveNote: '', knownGaps: [] },
      ),
    ).toThrow(/curta/);
    expect(() =>
      parseApprovedBrief({ objective: 'hack', sections: [] }),
    ).toThrow(/objetivo/);
    expect(parseStoredBrief({ objective: 'nope' })).toBeNull();
    expect(parseStoredBrief(null)).toBeNull();
  });

  it('aceita uma seção editada e não deixa path na imagem', () => {
    const approved = parseApprovedBrief({
      objective: 'other',
      objectiveNote: 'Página para o lançamento de março',
      sections: [
        {
          id: 'hero',
          kind: 'hero',
          title: 'Lançamento',
          purpose: 'Campanha de março',
          cta: '',
        },
      ],
      gaps: [
        {
          key: 'whatsapp',
          label: 'WhatsApp',
          note: 'Não inventar número.',
          confidence: 'identified',
        },
      ],
      images: [
        { filename: '../segredo.jpg', section: 'hero', kind: 'photo' },
        { filename: 'hero.jpg', section: 'hero', kind: 'photo' },
      ],
      notes: 'Cores sóbrias',
    });
    expect(approved.sections).toHaveLength(1);
    expect(approved.images.map((image) => image.filename)).toEqual([
      'hero.jpg',
    ]);
    expect(approved.gaps[0].confidence).toBe('identified');
    expect(approved.notes).toBe('Cores sóbrias');
  });
});
