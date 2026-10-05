/**
 * FFmpeg.wasm already runs its core in an internal Web Worker via `@ffmpeg/ffmpeg`.
 * This module exists as the extension point if we later isolate the export graph
 * (download + exec + progress) behind an explicit Comlink worker without COOP/COEP.
 */
export type FfmpegWorkerRequest =
  | { type: "load" }
  | { type: "cancel" }
  | {
      type: "export";
      args: string[];
      files: Array<{ name: string; data: ArrayBuffer }>;
      outputName: string;
    };

export type FfmpegWorkerResponse =
  | { type: "ready" }
  | { type: "progress"; ratio: number; message: string }
  | { type: "done"; data: ArrayBuffer }
  | { type: "error"; message: string };
