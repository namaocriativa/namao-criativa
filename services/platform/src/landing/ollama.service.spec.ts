import { parseJsonValue } from './ollama.service';

describe('parseJsonValue', () => {
  it('parseia JSON puro', () => {
    expect(parseJsonValue('{"ok":true}')).toEqual({ ok: true });
  });

  it('extrai JSON de fence markdown', () => {
    expect(parseJsonValue('```json\n{"n":1}\n```')).toEqual({ n: 1 });
  });
});
