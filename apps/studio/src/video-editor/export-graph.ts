import type { EditDocument } from "./document";

export type ExportPreset = "9:16" | "16:9" | "1:1";

export const EXPORT_PRESET_SIZE: Record<
  ExportPreset,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export type FfmpegPlan = {
  inputs: Array<{
    path: string;
    localPath: string;
    mimeType: string;
    rasterClipId?: string;
  }>;
  args: string[];
  outputName: string;
};

function uniqueName(localPath: string, index: number): string {
  const base = localPath.split("/").pop() || `media-${index}`;
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `in${index}_${safe}`;
}

function scaleFilter(
  width: number,
  height: number,
  fit: string,
): string {
  if (fit === "cover") {
    return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  }
  if (fit === "stretch") {
    return `scale=${width}:${height}`;
  }
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
}

/** Builds a re-encode export graph (MVP-safe across mixed codecs). */
export function buildExportPlan(
  doc: EditDocument,
  preset: ExportPreset,
): FfmpegPlan {
  const size = EXPORT_PRESET_SIZE[preset];
  const durationSec = Math.max(0.1, doc.durationMs / 1000);
  const inputs: FfmpegPlan["inputs"] = [];
  const inputIndex = new Map<string, number>();

  function ensureInput(localPath: string, mimeType: string): number {
    const existing = inputIndex.get(localPath);
    if (existing != null) return existing;
    const idx = inputs.length;
    inputs.push({
      path: uniqueName(localPath, idx),
      localPath,
      mimeType,
    });
    inputIndex.set(localPath, idx);
    return idx;
  }

  function ensureRaster(clipId: string): number {
    const key = `raster:${clipId}`;
    const existing = inputIndex.get(key);
    if (existing != null) return existing;
    const idx = inputs.length;
    inputs.push({
      path: `text_${idx}.png`,
      localPath: key,
      mimeType: "image/png",
      rasterClipId: clipId,
    });
    inputIndex.set(key, idx);
    return idx;
  }

  const videoTrack = doc.tracks.find((t) => t.type === "video");
  const audioTrack = doc.tracks.find((t) => t.type === "audio");
  const overlayTrack = doc.tracks.find((t) => t.type === "overlay");

  const videoClips = [...(videoTrack?.clips || [])].sort(
    (a, b) => a.startMs - b.startMs,
  );
  const audioClips = [...(audioTrack?.clips || [])].filter(
    (c) => !c.muted && !audioTrack?.muted,
  );
  const overlayClips = [...(overlayTrack?.clips || [])].filter(
    (c) => c.media.kind === "image" || c.media.kind === "text",
  );

  for (const clip of [...videoClips, ...audioClips]) {
    ensureInput(clip.media.localPath, clip.media.mimeType);
  }
  for (const clip of overlayClips) {
    if (clip.media.kind === "text") ensureRaster(clip.id);
    else ensureInput(clip.media.localPath, clip.media.mimeType);
  }

  const filters: string[] = [];
  const args: string[] = [];

  // Video concat chain
  if (videoClips.length === 0) {
    filters.push(
      `color=c=black:s=${size.width}x${size.height}:d=${durationSec.toFixed(3)},fps=30,format=yuv420p[vbase]`,
    );
  } else {
    const labels: string[] = [];
    videoClips.forEach((clip, i) => {
      const idx = ensureInput(clip.media.localPath, clip.media.mimeType);
      const start = (clip.inMs / 1000).toFixed(3);
      const dur = (Math.max(100, clip.durationMs) / 1000).toFixed(3);
      const scale = scaleFilter(
        size.width,
        size.height,
        clip.transform?.fit || "contain",
      );
      if (clip.media.kind === "image") {
        filters.push(
          `[${idx}:v]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:black,loop=loop=-1:size=1:start=0,trim=duration=${dur},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${i}]`,
        );
      } else {
        filters.push(
          `[${idx}:v]trim=start=${start}:duration=${dur},setpts=PTS-STARTPTS,${scale},fps=30,format=yuv420p[v${i}]`,
        );
      }
      labels.push(`[v${i}]`);
    });
    filters.push(
      `${labels.join("")}concat=n=${videoClips.length}:v=1:a=0[vbase]`,
    );
  }

  // Overlay images on top of vbase
  let videoOut = "[vbase]";
  overlayClips.forEach((clip, i) => {
    const idx =
      clip.media.kind === "text"
        ? ensureRaster(clip.id)
        : ensureInput(clip.media.localPath, clip.media.mimeType);
    const enableStart = (clip.startMs / 1000).toFixed(3);
    const enableEnd = ((clip.startMs + clip.durationMs) / 1000).toFixed(3);
    const next = i === overlayClips.length - 1 ? "[vout]" : `[vov${i}]`;
    if (clip.media.kind === "text") {
      filters.push(
        `[${idx}:v]scale=${size.width}:${size.height}[ov${i}]`,
      );
      filters.push(
        `${videoOut}[ov${i}]overlay=0:0:enable='between(t\\,${enableStart}\\,${enableEnd})'${next}`,
      );
    } else {
      const scale = clip.transform?.scale ?? 1;
      filters.push(`[${idx}:v]scale=iw*${scale}:ih*${scale}[ov${i}]`);
      filters.push(
        `${videoOut}[ov${i}]overlay=(W-w)/2:(H-h)/2:enable='between(t\\,${enableStart}\\,${enableEnd})'${next}`,
      );
    }
    videoOut = next;
  });
  if (videoOut !== "[vout]") {
    filters.push(`${videoOut}format=yuv420p[vout]`);
  }

  // Audio: video clip audio (if not muted) + audio track
  const audioLabels: string[] = [];
  videoClips.forEach((clip, i) => {
    if (clip.media.kind === "image") return;
    if (clip.muted || videoTrack?.muted) return;
    const idx = ensureInput(clip.media.localPath, clip.media.mimeType);
    const start = (clip.inMs / 1000).toFixed(3);
    const dur = (Math.max(100, clip.durationMs) / 1000).toFixed(3);
    const delay = Math.max(0, Math.round(clip.startMs));
    filters.push(
      `[${idx}:a]atrim=start=${start}:duration=${dur},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${delay}|${delay},aformat=sample_fmts=fltp:channel_layouts=stereo[va${i}]`,
    );
    audioLabels.push(`[va${i}]`);
  });
  audioClips.forEach((clip, i) => {
    const idx = ensureInput(clip.media.localPath, clip.media.mimeType);
    const start = (clip.inMs / 1000).toFixed(3);
    const dur = (Math.max(100, clip.durationMs) / 1000).toFixed(3);
    const delay = Math.max(0, Math.round(clip.startMs));
    filters.push(
      `[${idx}:a]atrim=start=${start}:duration=${dur},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${delay}|${delay},aformat=sample_fmts=fltp:channel_layouts=stereo[aa${i}]`,
    );
    audioLabels.push(`[aa${i}]`);
  });

  for (const input of inputs) {
    args.push("-i", input.path);
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]");

  if (audioLabels.length === 1) {
    filters.push(`${audioLabels[0]}anull[aout]`);
    // rebuild filter string with aout
    args[args.indexOf("-filter_complex") + 1] = filters.join(";");
    args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
  } else if (audioLabels.length > 1) {
    filters.push(
      `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[aout]`,
    );
    args[args.indexOf("-filter_complex") + 1] = filters.join(";");
    args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
  } else {
    args.push("-an");
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-t",
    durationSec.toFixed(3),
    "out.mp4",
  );

  return { inputs, args, outputName: "out.mp4" };
}
