import { createEmptyEditDocument, recomputeDuration } from './edit-document';

describe('edit-document', () => {
  it('creates default tracks', () => {
    const doc = createEmptyEditDocument();
    expect(doc.version).toBe(1);
    expect(doc.tracks.map((t) => t.type)).toEqual([
      'video',
      'audio',
      'overlay',
    ]);
  });

  it('recomputes duration from clips', () => {
    const doc = createEmptyEditDocument();
    doc.tracks[0].clips.push({
      id: 'c1',
      mediaId: 'm1',
      media: {
        kind: 'video',
        localPath: 'storage/a.mp4',
        mimeType: 'video/mp4',
      },
      startMs: 500,
      durationMs: 1500,
      inMs: 0,
      outMs: 1500,
      volume: 1,
      muted: false,
    });
    expect(recomputeDuration(doc)).toBe(2000);
  });
});
