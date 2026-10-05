export type EditFit = 'contain' | 'cover' | 'stretch';

export type EditTrackType = 'video' | 'audio' | 'overlay';

export type EditMediaKind = 'video' | 'image' | 'audio';

export type EditMediaRef = {
  kind: EditMediaKind;
  localPath: string;
  mimeType: string;
  label?: string;
  sourceAssetId?: string;
  origin?: string;
};

export type EditClip = {
  id: string;
  mediaId: string;
  media: EditMediaRef;
  startMs: number;
  durationMs: number;
  inMs: number;
  outMs: number;
  volume: number;
  muted: boolean;
  transform?: {
    x: number;
    y: number;
    scale: number;
    fit: EditFit;
  };
};

export type EditTrack = {
  id: string;
  type: EditTrackType;
  muted?: boolean;
  clips: EditClip[];
};

export type EditDocument = {
  version: 1;
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number; fit: EditFit };
  tracks: EditTrack[];
  mediaLibrary: Record<string, EditMediaRef & { id: string }>;
};

export function createEmptyEditDocument(): EditDocument {
  return {
    version: 1,
    fps: 30,
    durationMs: 0,
    canvas: { width: 1080, height: 1920, fit: 'contain' },
    tracks: [
      { id: 'track-video-1', type: 'video', clips: [] },
      { id: 'track-audio-1', type: 'audio', muted: false, clips: [] },
      { id: 'track-overlay-1', type: 'overlay', clips: [] },
    ],
    mediaLibrary: {},
  };
}

export function recomputeDuration(doc: EditDocument): number {
  let max = 0;
  for (const track of doc.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.startMs + clip.durationMs);
    }
  }
  return max;
}
