import { hrefFor, type AppRoute } from "./router";
import { canAccessImages, canAccessVideos } from "./session";
import { isVideoCreativeSkill } from "./creative/features";

export type CreativeKindTab = "image" | "video" | "gallery";

export function creativeKindFromRoute(route: AppRoute): CreativeKindTab | null {
  if (route.name === "criativo-gallery") return "gallery";
  if (route.name === "criativo") {
    return route.kind === "video" ? "video" : "image";
  }
  if (route.name === "criativo-skill") {
    return isVideoCreativeSkill(route.id) ? "video" : "image";
  }
  if (route.name === "imagens" || route.name === "imagens-project") {
    return "image";
  }
  if (route.name === "videos" || route.name === "videos-project") {
    return "video";
  }
  return null;
}

export function renderCreativeKinds(
  host: HTMLElement,
  active: CreativeKindTab,
): void {
  const imageOk = canAccessImages();
  const videoOk = canAccessVideos();
  const galleryOk = imageOk || videoOk;
  host.innerHTML = [
    imageOk
      ? kindLink(hrefFor({ name: "criativo", kind: "image" }), "Imagem", active === "image")
      : "",
    videoOk
      ? kindLink(hrefFor({ name: "criativo", kind: "video" }), "Vídeo", active === "video")
      : "",
    galleryOk
      ? kindLink(hrefFor({ name: "criativo-gallery" }), "Galeria", active === "gallery")
      : "",
  ].join("");
}

function kindLink(href: string, label: string, active: boolean): string {
  return `<a href="${href}" class="${active ? "active" : ""}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}
