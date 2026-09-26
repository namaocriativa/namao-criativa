import {
  clampWords,
  hasSaveOrCommentCta,
  wordCount,
  withSaveOrCommentCta,
} from './copy-limits';

describe('copy-limits', () => {
  it('conta e corta palavras em português', () => {
    expect(wordCount('  Salve este carrossel agora  ')).toBe(4);
    expect(clampWords('Uma duas três quatro cinco', 3)).toBe('Uma duas três');
    expect(clampWords('   ', 3, 'fallback')).toBe('fallback');
  });

  it('reconhece CTA de save ou comentário', () => {
    expect(hasSaveOrCommentCta('Salve este carrossel')).toBe(true);
    expect(hasSaveOrCommentCta('Comenta EU QUERO')).toBe(true);
    expect(hasSaveOrCommentCta('Siga o perfil')).toBe(false);
    expect(withSaveOrCommentCta('Siga o perfil')).toContain('Salve este carrossel');
    expect(withSaveOrCommentCta('Salve agora')).toBe('Salve agora');
  });
});
