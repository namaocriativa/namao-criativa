import { defaultClipText, type ClipTextStyle } from "./text-styles";

export type EditFit = "contain" | "cover" | "stretch";
export type EditTrackType = "video" | "audio" | "overlay";
export type EditMediaKind = "video" | "image" | "audio" | "text";

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
  text?: ClipTextStyle;
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

export type EditorSelection = {
  trackId: string | null;
  clipId: string | null;
};

export type EditorState = {
  projectId: string | null;
  name: string;
  document: EditDocument;
  selection: EditorSelection;
  playheadMs: number;
  playing: boolean;
  dirty: boolean;
  saving: boolean;
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyEditDocument(): EditDocument {
  return {
    version: 1,
    fps: 30,
    durationMs: 0,
    canvas: { width: 1080, height: 1920, fit: "contain" },
    tracks: [
      { id: "track-video-1", type: "video", clips: [] },
      { id: "track-audio-1", type: "audio", muted: false, clips: [] },
      { id: "track-overlay-1", type: "overlay", clips: [] },
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

export function cloneDocument(doc: EditDocument): EditDocument {
  return structuredClone(doc);
}

export function mediaKindFromMime(mime: string): EditMediaKind {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return "video";
}

export function storageUrl(localPath: string): string {
  const path = localPath.replace(/^\/+/, "");
  return path.startsWith("storage/") ? `/${path}` : `/storage/${path}`;
}

export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Listener = () => void;

export class EditDocumentStore {
  private state: EditorState;
  private listeners = new Set<Listener>();
  private playheadListeners = new Set<Listener>();
  private undoStack: EditDocument[] = [];
  private redoStack: EditDocument[] = [];
  private readonly maxHistory = 50;

  constructor() {
    this.state = {
      projectId: null,
      name: "",
      document: createEmptyEditDocument(),
      selection: { trackId: null, clipId: null },
      playheadMs: 0,
      playing: false,
      dirty: false,
      saving: false,
    };
  }

  getState(): EditorState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribePlayhead(fn: Listener): () => void {
    this.playheadListeners.add(fn);
    return () => this.playheadListeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
    for (const fn of this.playheadListeners) fn();
  }

  private emitPlayhead() {
    for (const fn of this.playheadListeners) fn();
  }

  private pushHistory() {
    this.undoStack.push(cloneDocument(this.state.document));
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  private mutate(
    mutator: (doc: EditDocument) => void,
    opts?: { history?: boolean },
  ) {
    if (opts?.history !== false) this.pushHistory();
    const doc = cloneDocument(this.state.document);
    mutator(doc);
    doc.durationMs = recomputeDuration(doc);
    this.state = {
      ...this.state,
      document: doc,
      dirty: true,
    };
    this.emit();
  }

  /** Commit a batch of silent mutations as a single undo step. */
  beginHistoryCheckpoint() {
    this.pushHistory();
  }

  updateClip(
    trackId: string,
    clipId: string,
    patch: Partial<
      Pick<
        EditClip,
        | "startMs"
        | "durationMs"
        | "inMs"
        | "outMs"
        | "volume"
        | "muted"
        | "transform"
        | "text"
      >
    >,
    opts?: { history?: boolean },
  ) {
    this.mutate((doc) => {
      const track = doc.tracks.find((t) => t.id === trackId);
      const clip = track?.clips.find((c) => c.id === clipId);
      if (!clip) return;
      Object.assign(clip, patch);
      if (patch.text) {
        clip.text = { ...(clip.text || patch.text), ...patch.text };
        clip.media = {
          ...clip.media,
          label: (clip.text.body || "Texto").slice(0, 48),
        };
      }
      if (patch.inMs != null || patch.outMs != null) {
        clip.durationMs = Math.max(100, clip.outMs - clip.inMs);
      }
      track?.clips.sort((a, b) => a.startMs - b.startMs);
    }, opts);
  }

  loadProject(projectId: string, name: string, document: EditDocument) {
    this.undoStack = [];
    this.redoStack = [];
    this.state = {
      projectId,
      name,
      document: {
        ...createEmptyEditDocument(),
        ...document,
        version: 1,
        tracks: document.tracks?.length
          ? document.tracks
          : createEmptyEditDocument().tracks,
        mediaLibrary: document.mediaLibrary || {},
        canvas: document.canvas || createEmptyEditDocument().canvas,
      },
      selection: { trackId: null, clipId: null },
      playheadMs: 0,
      playing: false,
      dirty: false,
      saving: false,
    };
    this.state.document.durationMs = recomputeDuration(this.state.document);
    this.emit();
  }

  clearProject() {
    this.undoStack = [];
    this.redoStack = [];
    this.state = {
      projectId: null,
      name: "",
      document: createEmptyEditDocument(),
      selection: { trackId: null, clipId: null },
      playheadMs: 0,
      playing: false,
      dirty: false,
      saving: false,
    };
    this.emit();
  }

  setName(name: string) {
    this.state = { ...this.state, name, dirty: true };
    this.emit();
  }

  setDirty(dirty: boolean) {
    this.state = { ...this.state, dirty };
    this.emit();
  }

  setSaving(saving: boolean) {
    this.state = { ...this.state, saving };
    this.emit();
  }

  setPlayhead(ms: number) {
    this.state = {
      ...this.state,
      playheadMs: Math.max(0, ms),
    };
    this.emitPlayhead();
  }

  setPlaying(playing: boolean) {
    this.state = { ...this.state, playing };
    this.emit();
  }

  select(trackId: string | null, clipId: string | null) {
    this.state = { ...this.state, selection: { trackId, clipId } };
    this.emit();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneDocument(this.state.document));
    this.state = {
      ...this.state,
      document: prev,
      dirty: true,
    };
    this.emit();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneDocument(this.state.document));
    this.state = {
      ...this.state,
      document: next,
      dirty: true,
    };
    this.emit();
  }

  addMediaToLibrary(ref: EditMediaRef & { id?: string }): string {
    const id = ref.id || uid("media");
    this.mutate((doc) => {
      doc.mediaLibrary[id] = { ...ref, id };
    });
    return id;
  }

  addTrack(type: EditTrackType) {
    this.mutate((doc) => {
      doc.tracks.push({
        id: uid(`track-${type}`),
        type,
        muted: false,
        clips: [],
      });
    });
  }

  addClipFromMedia(
    mediaId: string,
    opts?: { trackType?: EditTrackType; startMs?: number; durationMs?: number },
  ) {
    const media = this.state.document.mediaLibrary[mediaId];
    if (!media) return;
    const trackType: EditTrackType =
      opts?.trackType ||
      (media.kind === "audio"
        ? "audio"
        : media.kind === "image"
          ? "overlay"
          : "video");
    const durationMs =
      opts?.durationMs ??
      (media.kind === "image" ? 3000 : media.kind === "audio" ? 10000 : 5000);
    this.mutate((doc) => {
      let track = doc.tracks.find((t) => t.type === trackType);
      if (!track) {
        track = { id: uid(`track-${trackType}`), type: trackType, clips: [] };
        doc.tracks.push(track);
      }
      const startMs =
        opts?.startMs ??
        track.clips.reduce(
          (m, c) => Math.max(m, c.startMs + c.durationMs),
          0,
        );
      track.clips.push({
        id: uid("clip"),
        mediaId,
        media: { ...media },
        startMs,
        durationMs,
        inMs: 0,
        outMs: durationMs,
        volume: 1,
        muted: false,
        transform: { x: 0, y: 0, scale: 1, fit: "contain" },
      });
      track.clips.sort((a, b) => a.startMs - b.startMs);
    });
  }

  addTextClip(body = "Texto") {
    const style = defaultClipText(body);
    const clipId = uid("clip");
    let trackId = "";
    this.mutate((doc) => {
      let track = doc.tracks.find((t) => t.type === "overlay");
      if (!track) {
        track = { id: uid("track-overlay"), type: "overlay", clips: [] };
        doc.tracks.push(track);
      }
      trackId = track.id;
      const durationMs = 3000;
      const mediaId = uid("text");
      const media = {
        id: mediaId,
        kind: "text" as const,
        localPath: "",
        mimeType: "text/plain",
        label: style.body.slice(0, 48),
        origin: "text",
      };
      doc.mediaLibrary[mediaId] = media;
      track.clips.push({
        id: clipId,
        mediaId,
        media,
        startMs: Math.max(0, this.state.playheadMs),
        durationMs,
        inMs: 0,
        outMs: durationMs,
        volume: 1,
        muted: true,
        transform: { x: 0, y: 0, scale: 1, fit: "contain" },
        text: style,
      });
      track.clips.sort((a, b) => a.startMs - b.startMs);
    });
    if (trackId) this.select(trackId, clipId);
  }

  updateTrack(trackId: string, patch: Partial<Pick<EditTrack, "muted">>) {
    this.mutate((doc) => {
      const track = doc.tracks.find((t) => t.id === trackId);
      if (!track) return;
      Object.assign(track, patch);
    });
  }

  removeClip(trackId: string, clipId: string) {
    this.mutate((doc) => {
      const track = doc.tracks.find((t) => t.id === trackId);
      if (!track) return;
      track.clips = track.clips.filter((c) => c.id !== clipId);
    });
    if (this.state.selection.clipId === clipId) {
      this.select(null, null);
    }
  }

  splitClipAtPlayhead() {
    const { selection, playheadMs, document: doc } = this.state;
    if (!selection.trackId || !selection.clipId) return;
    const track = doc.tracks.find((t) => t.id === selection.trackId);
    const clip = track?.clips.find((c) => c.id === selection.clipId);
    if (!clip) return;
    const local = playheadMs - clip.startMs;
    if (local <= 100 || local >= clip.durationMs - 100) return;
    this.mutate((d) => {
      const t = d.tracks.find((x) => x.id === selection.trackId);
      const c = t?.clips.find((x) => x.id === selection.clipId);
      if (!t || !c) return;
      const splitLocal = playheadMs - c.startMs;
      const rightIn = c.inMs + splitLocal;
      const right: EditClip = {
        id: uid("clip"),
        mediaId: c.mediaId,
        media: { ...c.media },
        startMs: playheadMs,
        durationMs: c.durationMs - splitLocal,
        inMs: rightIn,
        outMs: c.outMs,
        volume: c.volume,
        muted: c.muted,
        transform: c.transform ? { ...c.transform } : undefined,
        text: c.text ? { ...c.text } : undefined,
      };
      c.durationMs = splitLocal;
      c.outMs = c.inMs + splitLocal;
      t.clips.push(right);
      t.clips.sort((a, b) => a.startMs - b.startMs);
    });
  }

  setCanvasPreset(preset: "9:16" | "16:9" | "1:1") {
    const sizes = {
      "9:16": { width: 1080, height: 1920 },
      "16:9": { width: 1920, height: 1080 },
      "1:1": { width: 1080, height: 1080 },
    } as const;
    this.mutate((doc) => {
      doc.canvas = { ...doc.canvas, ...sizes[preset] };
    });
  }

  findClipAt(
    trackId: string,
    clipId: string,
  ): { track: EditTrack; clip: EditClip } | null {
    const track = this.state.document.tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!track || !clip) return null;
    return { track, clip };
  }

  activeClipsAt(ms: number): Array<{ track: EditTrack; clip: EditClip }> {
    const out: Array<{ track: EditTrack; clip: EditClip }> = [];
    for (const track of this.state.document.tracks) {
      for (const clip of track.clips) {
        const end = clip.startMs + clip.durationMs;
        if (ms >= clip.startMs && ms <= end) {
          out.push({ track, clip });
        }
      }
    }
    return out;
  }
}
