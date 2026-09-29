import {
  parseObjectives,
  parseTones,
  suggestTonesFromVoice,
  defaultPlanTitle,
  parseItemStatus,
  parseTool,
  applyItemSelection,
  appendVideoTakes,
  clampVideoTakeCount,
  linkVideoTakeAsset,
  markItemsSelected,
  toolForFormat,
  buildItemProductionPrompt,
  parsePlanItem,
  parseVideoTakes,
  previewMediaFromAssets,
  previewUrlForAsset,
  resolveVideoTakeToGenerate,
  scheduleAssetIds,
  type ContentPlanItem,
} from './content-plan.contract';

const sampleItem = (overrides: Partial<ContentPlanItem> = {}): ContentPlanItem => ({
  id: 'cp-1',
  week: 1,
  scheduledAt: '2026-09-29T12:00:00.000Z',
  format: 'carousel',
  objective: 'Leads',
  pillar: 'prova',
  journeyStage: 'educate',
  title: 'Capa',
  hook: 'Sua agenda vazia?',
  caption: 'Salve este post',
  structure: ['Abra o problema', 'Mostre o caminho', 'Convide'],
  visualDirection: 'Fotos reais',
  cta: 'Salve este post',
  status: 'draft',
  ...overrides,
});

describe('content-plan.contract', () => {
  it('limita objetivos a três códigos válidos', () => {
    expect(parseObjectives(['leads', 'brand', 'leads', 'hack', 'sales'])).toEqual([
      'leads',
      'brand',
      'sales',
    ]);
  });

  it('sugere tom próximo a partir da voz do feed', () => {
    expect(suggestTonesFromVoice(['direto', 'local'])).toContain('close');
    expect(suggestTonesFromVoice([])).toEqual(['professional', 'close']);
  });

  it('monta título padrão com o mês', () => {
    expect(defaultPlanTitle(['leads'], new Date('2026-09-28T12:00:00'))).toMatch(
      /Gerar leads/i,
    );
  });

  it('ignora tons desconhecidos', () => {
    expect(parseTones(['close', 'nope', 'fun'])).toEqual(['close', 'fun']);
  });

  it('aceita status e ferramenta da produção', () => {
    expect(parseItemStatus('created')).toBe('created');
    expect(parseItemStatus('nope')).toBe('draft');
    expect(parseTool('video')).toBe('video');
    expect(parseTool('nope')).toBeUndefined();
    expect(toolForFormat('static')).toBe('image');
    expect(toolForFormat('reel')).toBe('video');
    expect(toolForFormat('carousel')).toBe('carousel');
  });

  it('marca rascunhos como selecionados e aplica keepIds', () => {
    const items = markItemsSelected([
      sampleItem({ id: 'a', status: 'draft' }),
      sampleItem({ id: 'b', status: 'draft' }),
    ]);
    expect(items.map((item) => item.status)).toEqual(['selected', 'selected']);
    const next = applyItemSelection(items, ['a']);
    expect(next.find((item) => item.id === 'a')?.status).toBe('selected');
    expect(next.find((item) => item.id === 'b')?.status).toBe('dropped');
  });

  it('não derruba peça já criada ou agendada', () => {
    const next = applyItemSelection(
      [
        sampleItem({ id: 'a', status: 'created' }),
        sampleItem({ id: 'b', status: 'selected' }),
      ],
      ['b'],
    );
    expect(next.find((item) => item.id === 'a')?.status).toBe('created');
    expect(next.find((item) => item.id === 'b')?.status).toBe('selected');
  });

  it('monta o prompt da peça com hook e estrutura', () => {
    const prompt = buildItemProductionPrompt(sampleItem());
    expect(prompt).toContain('Hook: Sua agenda vazia?');
    expect(prompt).toContain('1. Abra o problema');
    expect(prompt).toContain('Direção visual: Fotos reais');
  });

  it('monta o preview a partir do arquivo no storage', () => {
    expect(previewUrlForAsset('storage/image-projects/p1/gen.png')).toBe(
      '/storage/image-projects/p1/gen.png',
    );
    expect(previewUrlForAsset('/storage/video-projects/p1/clip.mp4')).toBe(
      '/storage/video-projects/p1/clip.mp4',
    );
    expect(
      previewMediaFromAssets([
        { id: 'a1', localPath: 'storage/image-projects/p1/a.png' },
        { id: 'a2' },
      ]),
    ).toEqual({
      studioAssetIds: ['a1', 'a2'],
      previewUrls: ['/storage/image-projects/p1/a.png'],
    });
  });

  it('preserva o personagem da peça', () => {
    expect(parsePlanItem({ ...sampleItem(), characterId: 'ch-1' }).characterId).toBe(
      'ch-1',
    );
  });

  it('preserva o hook visual da peça', () => {
    expect(
      parsePlanItem({ ...sampleItem(), videoHookId: 'stunt-cinematic' }).videoHookId,
    ).toBe('stunt-cinematic');
  });

  it('acumula takes de vídeo e agenda só a selecionada', () => {
    const merged = appendVideoTakes(
      {
        studioAssetIds: ['v1'],
        previewUrls: ['/storage/video-projects/p/a.mp4'],
      },
      {
        studioAssetIds: ['v2'],
        previewUrls: ['/storage/video-projects/p/b.mp4'],
      },
    );
    expect(merged).toEqual({
      studioAssetIds: ['v1', 'v2'],
      previewUrls: [
        '/storage/video-projects/p/a.mp4',
        '/storage/video-projects/p/b.mp4',
      ],
      selectedStudioAssetId: 'v2',
    });
    expect(
      scheduleAssetIds(
        parsePlanItem({
          ...sampleItem(),
          format: 'reel',
          tool: 'video',
          studioAssetIds: ['v1', 'v2'],
          selectedStudioAssetId: 'v1',
        }),
      ),
    ).toEqual(['v1']);
    expect(
      scheduleAssetIds(
        parsePlanItem({
          ...sampleItem(),
          format: 'reel',
          tool: 'video',
          studioAssetIds: ['v1', 'v2'],
        }),
      ),
    ).toEqual(['v2']);
  });

  it('parseia videoTakes e resolve a próxima a gerar', () => {
    expect(clampVideoTakeCount(1)).toBe(2);
    expect(clampVideoTakeCount(9)).toBe(5);
    const takes = parseVideoTakes([
      {
        id: 'take-1',
        label: 'Take 1 · Hook',
        beat: 'Abre com a dor',
        productionPrompt: 'FPV curto do gancho',
      },
      {
        id: 'take-2',
        label: 'Take 2 · CTA',
        beat: 'Fecha com CTA',
        productionPrompt: 'Close do convite',
        studioAssetId: 'clip-2',
      },
      { id: 'broken' },
    ]);
    expect(takes).toHaveLength(2);
    expect(
      parsePlanItem({
        ...sampleItem(),
        format: 'reel',
        videoTakes: takes,
      }).videoTakes?.[0].label,
    ).toMatch(/Hook/);
    expect(
      resolveVideoTakeToGenerate(
        parsePlanItem({ ...sampleItem(), videoTakes: takes }),
      )?.id,
    ).toBe('take-1');
    expect(
      linkVideoTakeAsset(takes, 'take-1', 'clip-1')?.[0].studioAssetId,
    ).toBe('clip-1');
  });
});
