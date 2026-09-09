import { parseJsonValue } from './json-parse';

describe('parseJsonValue', () => {
  it('parses raw JSON', () => {
    expect(parseJsonValue('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses fenced JSON', () => {
    expect(parseJsonValue('```json\n{"n":1}\n```')).toEqual({ n: 1 });
  });
});
