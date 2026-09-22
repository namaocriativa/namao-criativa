import { defaultVideoProjectSettings } from './video-models';
import { buildGeminiVideoRequest } from './gemini-video.provider';

describe('buildGeminiVideoRequest', () => {
  const settings = {
    ...defaultVideoProjectSettings(),
    aspectRatio: '9:16',
    duration: '10s',
    resolution: '1080p',
    thinkingLevel: 'high',
  };

  it('usa image_to_video com frames e response_format', () => {
    const body = buildGeminiVideoRequest({
      model: 'gemini-omni-1.1-flash',
      prompt: 'a criança se aproxima da piscina',
      frames: [{ mimeType: 'image/png', data: 'aaa' }],
      settings,
    });

    expect(body.model).toBe('gemini-omni-1.1-flash');
    expect(body.store).toBe(true);
    expect(body.response_format).toEqual({
      type: 'video',
      aspect_ratio: '9:16',
      resolution: '1080p',
      duration: '10s',
    });
    expect(body.generation_config).toEqual({
      thinking_level: 'high',
      video_config: { task: 'image_to_video' },
    });
    expect(body.input).toEqual([
      { type: 'image', mime_type: 'image/png', data: 'aaa' },
      { type: 'text', text: 'a criança se aproxima da piscina' },
    ]);
    expect(body.previous_interaction_id).toBeUndefined();
  });

  it('usa text_to_video sem frames', () => {
    const body = buildGeminiVideoRequest({
      model: 'gemini-omni-1.1-flash',
      prompt: 'drone sobre a montanha',
      frames: [],
      settings,
    });
    expect(body.input).toBe('drone sobre a montanha');
    expect(body.generation_config).toEqual(
      expect.objectContaining({
        video_config: { task: 'text_to_video' },
      }),
    );
  });

  it('omite task quando há previous_interaction_id', () => {
    const body = buildGeminiVideoRequest({
      model: 'gemini-omni-1.1-flash',
      prompt: 'Continue a cena',
      frames: [],
      previousInteractionId: 'v1_prev',
      settings,
    });
    expect(body.previous_interaction_id).toBe('v1_prev');
    expect(
      (body.generation_config as { video_config?: unknown }).video_config,
    ).toBeUndefined();
  });
});
