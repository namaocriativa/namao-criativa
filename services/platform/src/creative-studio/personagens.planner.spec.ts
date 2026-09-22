import {
  buildCharacterIdentityPrompt,
  characterPhotoPrompt,
  characterPortraitPrompt,
  characterVideoPrompt,
  mergeCharacterSystemInstruction,
} from './personagens.planner';

describe('personagens.planner', () => {
  const identity = {
    name: 'Luma',
    appearance: 'cabelo ruivo curto, sardas, jaqueta verde',
    personality: 'calma e observadora',
  };

  it('trava nome, aparência e personalidade no prompt de identidade', () => {
    const prompt = buildCharacterIdentityPrompt(identity);
    expect(prompt).toContain('Luma');
    expect(prompt).toContain('cabelo ruivo curto');
    expect(prompt).toContain('calma e observadora');
  });

  it('monta retrato, foto de cena e vídeo com a mesma identidade', () => {
    expect(characterPortraitPrompt(identity)).toContain('Retrato de ficha');
    expect(characterPortraitPrompt(identity)).toContain('personagens');
    expect(characterPhotoPrompt(identity, 'correndo na chuva')).toContain(
      'correndo na chuva',
    );
    expect(characterVideoPrompt(identity, 'acena para a câmera')).toContain(
      'acena para a câmera',
    );
  });

  it('concatena a instrução de lock com o briefing', () => {
    const merged = mergeCharacterSystemInstruction('Personagem canônico: Luma.');
    expect(merged).toContain('mesmo personagem');
    expect(merged).toContain('Personagem canônico: Luma.');
  });
});
