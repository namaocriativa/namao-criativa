import { estimateProduce } from './content-plan.estimate';

describe('content-plan.estimate', () => {
  it('soma o roteiro e as 5 imagens do carrossel', () => {
    const estimate = estimateProduce({
      format: 'carousel',
      slides: 5,
      planModel: 'gemini-2.5-flash',
      imageModel: 'gemini-3-pro-image',
      imageSize: '2K',
    });
    expect(estimate.stages.map((stage) => stage.id)).toEqual(['plan', 'slides']);
    expect(estimate.stages[1]?.label).toBe('5 imagens');
    expect(estimate.stages[1]?.count).toBe(5);
    expect(estimate.stages[1]?.detail).toContain('5 ×');
    expect(estimate.stages[1]?.usd).toBe(0.67);
    expect(estimate.label).toMatch(/5 imagens/);
  });

  it('muda o custo quando o modelo de imagem muda', () => {
    const pro = estimateProduce({
      format: 'carousel',
      slides: 5,
      imageModel: 'gemini-3-pro-image',
      imageSize: '2K',
    });
    const lite = estimateProduce({
      format: 'carousel',
      slides: 5,
      imageModel: 'gemini-3.1-flash-lite-image',
      imageSize: '1K',
    });
    expect(lite.stages[1]?.usd).toBe(0.1);
    expect(lite.usd).toBeLessThan(pro.usd);
  });

  it('estima uma imagem estática', () => {
    const estimate = estimateProduce({
      format: 'static',
      imageModel: 'gemini-2.5-flash-image',
      imageSize: '1K',
    });
    expect(estimate.stages).toHaveLength(1);
    expect(estimate.stages[0]?.id).toBe('image');
    expect(estimate.usd).toBe(0.04);
  });

  it('estima o vídeo 9:16', () => {
    const estimate = estimateProduce({
      format: 'reel',
      videoModel: 'gemini-omni-1.1-flash',
      duration: '8s',
      resolution: '360p',
    });
    expect(estimate.stages[0]?.id).toBe('video');
    expect(estimate.usd).toBeGreaterThan(0);
  });
});
