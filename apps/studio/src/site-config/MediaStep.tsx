import { useEffect, useMemo, useState } from "react";
import type { Lead, LeadImage } from "../types";
import type { LandingSectionConfig } from "./section-catalog";
import { compactSectionMedia } from "./wizard-payload";

export type HeroVideoSlot = "background" | "portrait";

type HeroVideoFile = {
  filename: string;
  publicPath: string;
  previewUrl?: string;
  slot?: HeroVideoSlot;
};

type MediaStepProps = {
  leadId: string | null;
  sections: LandingSectionConfig[];
  heroSupportsStockVideo: boolean;
  stockVideo: boolean;
  onStockVideo: (on: boolean) => void;
  onPatchMedia: (
    sectionId: string,
    media: LandingSectionConfig["media"] | undefined,
  ) => void;
  onPatchHeroVideo: (slot: HeroVideoSlot, publicPath: string) => void;
};

const VIDEO_SLOT_COPY: Record<HeroVideoSlot, { title: string; hint: string }> = {
  background: {
    title: "Vídeo de fundo",
    hint: "Full screen atrás do texto. MP4 ou WebM.",
  },
  portrait: {
    title: "Vídeo retrato",
    hint: "Quadro vertical à direita (hero split-video). MP4 ou WebM.",
  },
};

function imagePublicPath(img: LeadImage): string {
  const filename = img.filename || img.localPath.split("/").pop() || "";
  return `/images/${filename}`;
}

function imagePreview(img: LeadImage): string {
  return `/${img.localPath.replace(/^\/+/, "")}`;
}

function maxImagesFor(type: string): number {
  if (type === "gallery") return 20;
  if (type === "hero") return 4;
  if (
    type === "header" ||
    type === "footer" ||
    type === "about" ||
    type === "cta"
  ) {
    return 1;
  }
  return 4;
}

function mediaHint(type: string): string {
  switch (type) {
    case "header":
    case "footer":
      return "Uma imagem vira o logo da marca.";
    case "hero":
      return "Foto de abertura, mais os vídeos se o template usar.";
    case "about":
    case "cta":
      return "Uma foto ao lado do texto.";
    case "gallery":
      return "Todas as fotos selecionadas entram na galeria.";
    default:
      return "A foto entra se o componente da seção tiver slot de imagem.";
  }
}

function compactMedia(
  media: NonNullable<LandingSectionConfig["media"]>,
): LandingSectionConfig["media"] | undefined {
  return compactSectionMedia(media);
}

export function MediaStep({
  leadId,
  sections,
  heroSupportsStockVideo,
  stockVideo,
  onStockVideo,
  onPatchMedia,
  onPatchHeroVideo,
}: MediaStepProps) {
  const [focusId, setFocusId] = useState(
    () =>
      sections.find((item) => item.type === "hero")?.id ||
      sections[0]?.id ||
      "",
  );
  const [lead, setLead] = useState<Lead | null>(null);
  const [status, setStatus] = useState("");
  const [videos, setVideos] = useState<Partial<Record<HeroVideoSlot, HeroVideoFile>>>(
    {},
  );
  const [videoStatus, setVideoStatus] = useState<
    Partial<Record<HeroVideoSlot, string>>
  >({});

  const focused =
    sections.find((item) => item.id === focusId) || sections[0] || null;

  useEffect(() => {
    if (focused) return;
    if (sections[0]) setFocusId(sections[0].id);
  }, [focused, sections]);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setStatus("Abra o wizard a partir de um lead.");
      return;
    }
    let cancelled = false;
    void fetch(`/leads/${encodeURIComponent(leadId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Lead não encontrado"))))
      .then((data: Lead) => {
        if (!cancelled) setLead(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(
            error instanceof Error ? error.message : "Falha ao carregar imagens.",
          );
        }
      });
    void fetch(`/leads/${encodeURIComponent(leadId)}/videos`)
      .then((res) => (res.ok ? res.json() : { videos: [] }))
      .then((data: { videos?: Array<{ filename?: string; publicPath?: string; localPath?: string; slot?: string }> }) => {
        if (cancelled) return;
        const next: Partial<Record<HeroVideoSlot, HeroVideoFile>> = {};
        for (const item of data.videos || []) {
          const slot: HeroVideoSlot | null =
            item.slot === "portrait" || item.slot === "background"
              ? item.slot
              : /portrait/i.test(item.filename || "")
                ? "portrait"
                : /background/i.test(item.filename || "")
                  ? "background"
                  : null;
          if (!slot || !item.filename || !item.publicPath) continue;
          const local = String(item.localPath || "").replace(/^\/+/, "");
          next[slot] = {
            filename: item.filename,
            publicPath: item.publicPath,
            previewUrl: local ? `/${local}` : undefined,
            slot,
          };
        }
        setVideos(next);
        if (next.background?.publicPath) {
          onPatchHeroVideo("background", next.background.publicPath);
        }
        if (next.portrait?.publicPath) {
          onPatchHeroVideo("portrait", next.portrait.publicPath);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const images = lead?.images || [];
  const selected = focused?.media?.images || [];
  const max = focused ? maxImagesFor(focused.type) : 1;
  const isHero = focused?.type === "hero";

  const assignedLabel = useMemo(() => {
    if (!focused) return "Nenhuma seção";
    const count = focused.media?.images?.length || 0;
    const extras = [
      focused.media?.video ? "vídeo fundo" : "",
      focused.media?.portraitVideo ? "vídeo retrato" : "",
    ].filter(Boolean);
    if (!count && !extras.length) return "Sem mídia";
    return [count ? `${count} imagem(ns)` : "", ...extras].filter(Boolean).join(" · ");
  }, [focused]);

  function patch(sectionId: string, media: LandingSectionConfig["media"] | undefined) {
    onPatchMedia(sectionId, media);
  }

  function toggleImage(path: string) {
    if (!focused) return;
    const current = focused.media?.images || [];
    const has = current.includes(path);
    const imagesNext = has
      ? current.filter((item) => item !== path)
      : max === 1
        ? [path]
        : [...current, path].slice(0, max);
    const next: NonNullable<LandingSectionConfig["media"]> = {
      ...focused.media,
      images: imagesNext,
    };
    if (focused.type === "header" || focused.type === "footer") {
      next.logo = imagesNext[0];
    }
    if (!imagesNext.length) delete next.images;
    if (!next.logo) delete next.logo;
    patch(focused.id, compactMedia(next));
  }

  async function uploadImages(files: FileList | File[]) {
    if (!leadId) {
      setStatus("Abra o wizard a partir de um lead.");
      return;
    }
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) {
      setStatus("Selecione JPG, PNG, WEBP ou GIF.");
      return;
    }
    setStatus(`Enviando ${list.length} imagem(ns)…`);
    const body = new FormData();
    for (const file of list) body.append("files", file);
    try {
      const res = await fetch(`/leads/${encodeURIComponent(leadId)}/images`, {
        method: "POST",
        body,
      });
      const data = (await res.json()) as Lead & { message?: string };
      if (!res.ok) throw new Error(data.message || "Falha ao enviar imagens");
      setLead(data);
      setStatus("Imagens adicionadas. Clique para atribuir à seção.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha no envio");
    }
  }

  async function uploadVideo(slot: HeroVideoSlot, file: File) {
    if (!leadId || !focused) return;
    const previewUrl = URL.createObjectURL(file);
    setVideos((prev) => ({
      ...prev,
      [slot]: { filename: file.name, publicPath: prev[slot]?.publicPath || "", previewUrl, slot },
    }));
    setVideoStatus((prev) => ({ ...prev, [slot]: "Enviando…" }));
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(
        `/leads/${encodeURIComponent(leadId)}/videos?slot=${slot}`,
        { method: "POST", body },
      );
      const data = (await res.json()) as {
        filename?: string;
        publicPath?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.message || "Falha ao enviar vídeo");
      const publicPath = data.publicPath || "";
      setVideos((prev) => ({
        ...prev,
        [slot]: {
          filename: data.filename || file.name,
          publicPath,
          previewUrl,
          slot,
        },
      }));
      setVideoStatus((prev) => ({ ...prev, [slot]: "Pronto" }));
      onPatchHeroVideo(slot, publicPath);
    } catch (error) {
      setVideoStatus((prev) => ({
        ...prev,
        [slot]: error instanceof Error ? error.message : "Falha no envio",
      }));
    }
  }

  return (
    <div className="site-wizard__panel site-wizard__panel--media">
      <aside className="site-wizard-rail">
        <p className="site-wizard-rail__label">Seções</p>
        <ul className="site-wizard-list">
          {sections.map((section) => {
            const count = section.media?.images?.length || 0;
            const hasVideo = Boolean(section.media?.video || section.media?.portraitVideo);
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={
                    section.id === focused?.id
                      ? "site-wizard-section active"
                      : "site-wizard-section"
                  }
                  onClick={() => setFocusId(section.id)}
                >
                  <strong>{section.title}</strong>
                  <small>
                    {count || hasVideo
                      ? [count ? `${count} foto(s)` : "", hasVideo ? "vídeo" : ""]
                          .filter(Boolean)
                          .join(" · ")
                      : "Sem mídia"}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="site-wizard-picker">
        {focused ? (
          <>
            <p className="site-wizard-picker__title">{focused.title}</p>
            <p className="prompt-hint">{mediaHint(focused.type)}</p>
            <p className="meta">{assignedLabel}</p>
            {isHero && heroSupportsStockVideo ? (
              <label className="site-wizard-row">
                <input
                  type="checkbox"
                  checked={stockVideo}
                  onChange={(event) => onStockVideo(event.target.checked)}
                />
                <span>
                  <strong>Baixar vídeo genérico do nicho (Pexels)</strong>
                  <small>
                    A IA escolhe o termo. Só entra se o hero aceitar vídeo.
                  </small>
                </span>
              </label>
            ) : null}
            {isHero ? (
              <div className="site-wizard-videos">
                {(["background", "portrait"] as HeroVideoSlot[]).map((slot) => {
                  const copy = VIDEO_SLOT_COPY[slot];
                  const current = videos[slot];
                  const preview = current?.previewUrl || current?.publicPath;
                  return (
                    <label key={slot} className="site-wizard-video-slot">
                      <strong>{copy.title}</strong>
                      <small>{copy.hint}</small>
                      {preview ? (
                        <video src={preview} muted playsInline loop />
                      ) : null}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void uploadVideo(slot, file);
                        }}
                      />
                      <span>
                        {videoStatus[slot] ||
                          (current?.filename
                            ? current.filename
                            : "Nenhum arquivo ainda")}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <p className="prompt-hint">Selecione uma seção à esquerda.</p>
        )}
      </div>
      <div className="site-wizard-media-library">
        <p className="site-wizard-rail__label">Biblioteca do lead</p>
        <p className="prompt-hint">
          Enrichment + uploads. Clique para ligar ou desligar na seção ativa.
          Vídeos do hero ficam na seção Hero.
        </p>
        <label className="site-wizard-upload">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(event) => {
              const files = event.target.files;
              event.target.value = "";
              if (files?.length) void uploadImages(files);
            }}
          />
          Adicionar imagens
        </label>
        {status ? <p className="prompt-hint">{status}</p> : null}
        {images.length ? (
          <ul className="site-wizard-media-grid">
            {images.map((img) => {
              const path = imagePublicPath(img);
              const on = selected.includes(path);
              return (
                <li key={img.id || path}>
                  <button
                    type="button"
                    className={
                      on
                        ? "site-wizard-media-thumb is-on"
                        : "site-wizard-media-thumb"
                    }
                    onClick={() => toggleImage(path)}
                    title={img.filename || path}
                  >
                    <img src={imagePreview(img)} alt={img.filename || ""} />
                    <span>{on ? "Na seção" : "Usar"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="prompt-hint">Nenhuma imagem ainda. Envie arquivos acima.</p>
        )}
      </div>
    </div>
  );
}
