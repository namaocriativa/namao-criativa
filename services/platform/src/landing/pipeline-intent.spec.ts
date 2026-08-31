import { buildLeadBrief } from './lead-brief';
import {
  analyzePipelineIntent,
  heuristicDesignIds,
  shouldSkipVision,
} from './pipeline-intent';

describe('pipeline-intent', () => {
  it('pula visão sem imagens', () => {
    expect(shouldSkipVision(0)).toBe(true);
    expect(shouldSkipVision(2)).toBe(false);
  });

  it('pula review em brief pobre só com deterministic + hero', () => {
    const brief = buildLeadBrief({
      id: 'x',
      name: 'Loja',
      phone: '11999999999',
    });
    const intent = analyzePipelineIntent({
      brief,
      sections: [
        { id: 'header', type: 'header', title: 'Header', description: '' },
        { id: 'hero', type: 'hero', title: 'Hero', description: '' },
        { id: 'footer', type: 'footer', title: 'Footer', description: '' },
      ],
      vision: null,
      imageCount: 0,
    });
    expect(intent.skipVision).toBe(true);
    expect(intent.useHeuristicDesign).toBe(true);
    expect(intent.skipReview).toBe(true);
    expect(intent.complexity).toBe('simple');
  });

  it('não pula review quando há seção custom ou description', () => {
    const brief = buildLeadBrief({
      id: 'x',
      name: 'Loja',
      description: 'Texto real',
    });
    const intent = analyzePipelineIntent({
      brief,
      sections: [
        { id: 'hero', type: 'hero', title: 'Hero', description: '' },
        {
          id: 'horario',
          type: 'custom',
          title: 'Horário',
          description: 'Horário',
        },
      ],
      vision: null,
      imageCount: 0,
    });
    expect(intent.skipReview).toBe(false);
    expect(intent.useHeuristicDesign).toBe(false);
  });

  it('escolhe paleta jurídica por categoria', () => {
    expect(heuristicDesignIds({ category: 'Advogado' } as never).paletteId).toBe(
      'ink-gold',
    );
  });
});
