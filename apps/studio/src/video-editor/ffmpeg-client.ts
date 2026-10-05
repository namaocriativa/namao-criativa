import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { storageUrl, type EditClip, type EditDocument } from "./document";
import {
  buildExportPlan,
  EXPORT_PRESET_SIZE,
  type ExportPreset,
  type FfmpegPlan,
} from "./export-graph";
import { ensureTextFonts, rasterizeTextOverlay } from "./text-styles";

export type ExportProgress = {
  ratio: number;
  message: string;
};

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let cancelled = false;

async function getFfmpeg(
  onProgress?: (p: ExportProgress) => void,
): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loading) return loading;
  loading = (async () => {
    onProgress?.({ ratio: 0, message: "Carregando FFmpeg…" });
    const instance = new FFmpeg();
    instance.on("log", ({ message }) => {
      if (message.includes("time=")) {
        onProgress?.({ ratio: Math.min(0.95, (onProgress as unknown as { last?: number }).last || 0.3), message });
      }
    });
    instance.on("progress", ({ progress }) => {
      onProgress?.({
        ratio: Math.max(0, Math.min(0.99, progress)),
        message: `Renderizando… ${Math.round(progress * 100)}%`,
      });
    });
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
    ffmpeg = instance;
    return instance;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export function cancelExport() {
  cancelled = true;
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch {
      /* ignore */
    }
    ffmpeg = null;
  }
}

export async function runExport(
  doc: EditDocument,
  preset: ExportPreset,
  onProgress?: (p: ExportProgress) => void,
): Promise<Uint8Array> {
  cancelled = false;
  const plan = buildExportPlan(doc, preset);
  const ff = await getFfmpeg(onProgress);
  if (cancelled) throw new Error("Exportação cancelada");

  onProgress?.({ ratio: 0.05, message: "Baixando mídias…" });
  await writeInputs(ff, plan, doc, preset, onProgress);
  if (cancelled) throw new Error("Exportação cancelada");

  onProgress?.({ ratio: 0.2, message: "Codificando…" });
  const code = await ff.exec(plan.args);
  if (cancelled) throw new Error("Exportação cancelada");
  if (code !== 0) {
    throw new Error(`FFmpeg retornou código ${code}`);
  }
  const data = await ff.readFile(plan.outputName);
  await cleanup(ff, plan);
  onProgress?.({ ratio: 1, message: "Concluído" });
  if (data instanceof Uint8Array) return data;
  throw new Error("Saída inválida do FFmpeg");
}

async function writeInputs(
  ff: FFmpeg,
  plan: FfmpegPlan,
  doc: EditDocument,
  preset: ExportPreset,
  onProgress?: (p: ExportProgress) => void,
) {
  const size = EXPORT_PRESET_SIZE[preset];
  let i = 0;
  for (const input of plan.inputs) {
    if (cancelled) throw new Error("Exportação cancelada");
    if (input.rasterClipId) {
      const clip = findClip(doc, input.rasterClipId);
      if (!clip?.text) throw new Error("Clipe de texto não encontrado");
      ensureTextFonts();
      if (document.fonts?.ready) await document.fonts.ready;
      const data = await rasterizeTextOverlay(
        clip.text,
        clip.transform,
        size.width,
        size.height,
      );
      await ff.writeFile(input.path, data);
    } else {
      const url = storageUrl(input.localPath);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Falha ao baixar ${input.localPath}`);
      }
      const data = new Uint8Array(await res.arrayBuffer());
      await ff.writeFile(input.path, data);
    }
    i += 1;
    onProgress?.({
      ratio: 0.05 + (0.15 * i) / plan.inputs.length,
      message: `Mídia ${i}/${plan.inputs.length}`,
    });
  }
}

function findClip(doc: EditDocument, clipId: string): EditClip | undefined {
  for (const track of doc.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

async function cleanup(ff: FFmpeg, plan: FfmpegPlan) {
  for (const input of plan.inputs) {
    try {
      await ff.deleteFile(input.path);
    } catch {
      /* ignore */
    }
  }
  try {
    await ff.deleteFile(plan.outputName);
  } catch {
    /* ignore */
  }
}

/** Exposed for unit tests without wasm. */
export { buildExportPlan };
