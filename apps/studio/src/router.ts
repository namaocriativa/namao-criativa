import { isVideoCreativeSkill } from "./creative/features";

export type AppRoute =
  | { name: "leads" }
  | { name: "lead"; id: string }
  | { name: "customers" }
  | { name: "customer"; id: string }
  | { name: "discovery" }
  | { name: "enrichment" }
  | { name: "packages" }
  | { name: "package"; id: string }
  | { name: "calendar" }
  | { name: "calendar-post"; id: string }
  | { name: "criativo"; kind: "image" | "video" }
  | { name: "criativo-skill"; id: string; characterId?: string; movieId?: string; clipId?: string }
  | { name: "criativo-gallery" }
  | { name: "imagens" }
  | { name: "imagens-project"; id: string }
  | { name: "videos" }
  | { name: "videos-project"; id: string }
  | { name: "ui-lib" }
  | { name: "config" }
  | { name: "users" }
  | { name: "user"; id: string }
  | { name: "not-found" };

const APP_TITLE = "Namão Studio";

let onChange: (route: AppRoute) => void = () => {};
let started = false;

export function parsePath(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/leads") return { name: "leads" };
  const lead = path.match(/^\/leads\/([^/]+)$/);
  if (lead?.[1]) {
    try {
      return { name: "lead", id: decodeURIComponent(lead[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/customers") return { name: "customers" };
  const customer = path.match(/^\/customers\/([^/]+)$/);
  if (customer?.[1]) {
    try {
      return { name: "customer", id: decodeURIComponent(customer[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/discovery") return { name: "discovery" };
  if (path === "/enrichment") return { name: "enrichment" };
  if (path === "/packages") return { name: "packages" };
  const pkg = path.match(/^\/packages\/([^/]+)$/);
  if (pkg?.[1]) {
    try {
      return { name: "package", id: decodeURIComponent(pkg[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/calendario") return { name: "calendar" };
  const calendarPost = path.match(/^\/calendario\/([^/]+)$/);
  if (calendarPost?.[1]) {
    try {
      return { name: "calendar-post", id: decodeURIComponent(calendarPost[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/criativo" || path === "/criativo/imagem") {
    return { name: "criativo", kind: "image" };
  }
  if (path === "/criativo/video") return { name: "criativo", kind: "video" };
  if (path === "/criativo/galeria") return { name: "criativo-gallery" };
  const characterSkill = path.match(
    /^\/criativo\/habilidade\/personagens\/([^/]+)$/,
  );
  if (characterSkill?.[1]) {
    try {
      return {
        name: "criativo-skill",
        id: "personagens",
        characterId: decodeURIComponent(characterSkill[1]),
      };
    } catch {
      return { name: "not-found" };
    }
  }
  const movieSkill = path.match(
    /^\/criativo\/habilidade\/movies\/([^/]+)$/,
  );
  if (movieSkill?.[1]) {
    try {
      return {
        name: "criativo-skill",
        id: "movies",
        movieId: decodeURIComponent(movieSkill[1]),
      };
    } catch {
      return { name: "not-found" };
    }
  }
  const startEndSkill = path.match(
    /^\/criativo\/habilidade\/(inicio-fim|ugc-skills)\/([^/]+)$/,
  );
  if (startEndSkill?.[1] && startEndSkill[2]) {
    try {
      return {
        name: "criativo-skill",
        id: startEndSkill[1],
        clipId: decodeURIComponent(startEndSkill[2]),
      };
    } catch {
      return { name: "not-found" };
    }
  }
  const skill = path.match(/^\/criativo\/habilidade\/([^/]+)$/);
  if (skill?.[1]) {
    try {
      return { name: "criativo-skill", id: decodeURIComponent(skill[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/criativo/imagens" || path === "/imagens") {
    return { name: "imagens" };
  }
  const imagensProject = path.match(
    /^\/(?:criativo\/)?imagens\/([^/]+)$/,
  );
  if (imagensProject?.[1]) {
    try {
      return { name: "imagens-project", id: decodeURIComponent(imagensProject[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/criativo/videos" || path === "/videos") {
    return { name: "videos" };
  }
  const videosProject = path.match(/^\/(?:criativo\/)?videos\/([^/]+)$/);
  if (videosProject?.[1]) {
    try {
      return { name: "videos-project", id: decodeURIComponent(videosProject[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  if (path === "/ui-lib") return { name: "ui-lib" };
  if (path === "/config") return { name: "config" };
  if (path === "/users") return { name: "users" };
  const user = path.match(/^\/users\/([^/]+)$/);
  if (user?.[1]) {
    try {
      return { name: "user", id: decodeURIComponent(user[1]) };
    } catch {
      return { name: "not-found" };
    }
  }
  return { name: "not-found" };
}

export function hrefFor(route: AppRoute): string {
  switch (route.name) {
    case "leads":
      return "/leads";
    case "lead":
      return `/leads/${encodeURIComponent(route.id)}`;
    case "customers":
      return "/customers";
    case "customer":
      return `/customers/${encodeURIComponent(route.id)}`;
    case "discovery":
      return "/discovery";
    case "enrichment":
      return "/enrichment";
    case "packages":
      return "/packages";
    case "package":
      return `/packages/${encodeURIComponent(route.id)}`;
    case "calendar":
      return "/calendario";
    case "calendar-post":
      return `/calendario/${encodeURIComponent(route.id)}`;
    case "criativo":
      return route.kind === "video" ? "/criativo/video" : "/criativo";
    case "criativo-skill":
      if (route.movieId) {
        return `/criativo/habilidade/${encodeURIComponent(route.id)}/${encodeURIComponent(route.movieId)}`;
      }
      if (route.characterId) {
        return `/criativo/habilidade/${encodeURIComponent(route.id)}/${encodeURIComponent(route.characterId)}`;
      }
      if (route.clipId) {
        return `/criativo/habilidade/${encodeURIComponent(route.id)}/${encodeURIComponent(route.clipId)}`;
      }
      return `/criativo/habilidade/${encodeURIComponent(route.id)}`;
    case "criativo-gallery":
      return "/criativo/galeria";
    case "imagens":
      return "/criativo/imagens";
    case "imagens-project":
      return `/criativo/imagens/${encodeURIComponent(route.id)}`;
    case "videos":
      return "/criativo/videos";
    case "videos-project":
      return `/criativo/videos/${encodeURIComponent(route.id)}`;
    case "ui-lib":
      return "/ui-lib";
    case "config":
      return "/config";
    case "users":
      return "/users";
    case "user":
      return `/users/${encodeURIComponent(route.id)}`;
    case "not-found":
      return "/404";
  }
}

export function tabForRoute(route: AppRoute): string {
  switch (route.name) {
    case "leads":
      return "leads";
    case "lead":
      return "detail";
    case "customers":
      return "customers";
    case "customer":
      return "detail";
    case "discovery":
      return "discovery";
    case "enrichment":
      return "enrichment";
    case "packages":
      return "packages";
    case "package":
      return "package-detail";
    case "calendar":
    case "calendar-post":
      return "calendar";
    case "criativo":
      return route.kind === "video" ? "videos-studio" : "imagens-studio";
    case "criativo-skill":
      return isVideoCreativeSkill(route.id) ? "videos-studio" : "imagens-studio";
    case "criativo-gallery":
      return "criativo-gallery";
    case "imagens":
      return "imagens-studio";
    case "imagens-project":
      return "imagens-studio";
    case "videos":
      return "videos-studio";
    case "videos-project":
      return "videos-studio";
    case "ui-lib":
      return "ui-lib";
    case "config":
      return "config";
    case "users":
      return "users";
    case "user":
      return "user-detail";
    case "not-found":
      return "not-found";
  }
}

export function navRouteFor(route: AppRoute): string | null {
  if (route.name === "not-found") return null;
  if (route.name === "lead") return "leads";
  if (route.name === "customer") return "customers";
  if (route.name === "package") return "packages";
  if (route.name === "calendar" || route.name === "calendar-post") {
    return "calendar";
  }
  if (
    route.name === "criativo" ||
    route.name === "criativo-skill" ||
    route.name === "criativo-gallery" ||
    route.name === "imagens" ||
    route.name === "imagens-project" ||
    route.name === "videos" ||
    route.name === "videos-project"
  ) {
    return "criativo";
  }
  if (route.name === "user") return "users";
  return route.name;
}

export function titleForRoute(route: AppRoute, leadName?: string): string {
  switch (route.name) {
    case "leads":
      return `Leads · ${APP_TITLE}`;
    case "lead":
      return `${leadName || "Lead"} · ${APP_TITLE}`;
    case "customers":
      return `Clientes · ${APP_TITLE}`;
    case "customer":
      return `${leadName || "Cliente"} · ${APP_TITLE}`;
    case "discovery":
      return `Descobrir · ${APP_TITLE}`;
    case "enrichment":
      return `Enriquecer · ${APP_TITLE}`;
    case "packages":
      return `Pacotes · ${APP_TITLE}`;
    case "package":
      return `${leadName || "Pacote"} · ${APP_TITLE}`;
    case "calendar":
      return `Calendário · ${APP_TITLE}`;
    case "calendar-post":
      return `${leadName || "Post"} · Calendário · ${APP_TITLE}`;
    case "criativo":
      return `Studio Criativo · ${APP_TITLE}`;
    case "criativo-skill":
      return `${leadName || "Habilidade"} · Studio Criativo · ${APP_TITLE}`;
    case "criativo-gallery":
      return `Galeria · Studio Criativo · ${APP_TITLE}`;
    case "imagens":
      return `Chat de imagem · Studio Criativo · ${APP_TITLE}`;
    case "imagens-project":
      return `${leadName || "Conversa"} · Studio Criativo · ${APP_TITLE}`;
    case "videos":
      return `Chat de vídeo · Studio Criativo · ${APP_TITLE}`;
    case "videos-project":
      return `${leadName || "Conversa"} · Studio Criativo · ${APP_TITLE}`;
    case "ui-lib":
      return `Componentes · ${APP_TITLE}`;
    case "config":
      return `Configurações · ${APP_TITLE}`;
    case "users":
      return `Equipe · ${APP_TITLE}`;
    case "user":
      return `${leadName || "Usuário"} · ${APP_TITLE}`;
    case "not-found":
      return `Não encontrado · ${APP_TITLE}`;
  }
}

export function isImagensStudioRoute(route: AppRoute): boolean {
  return (
    route.name === "imagens" ||
    route.name === "imagens-project" ||
    (route.name === "criativo-skill" && !isVideoCreativeSkill(route.id)) ||
    (route.name === "criativo" && route.kind === "image")
  );
}

export function isVideosStudioRoute(route: AppRoute): boolean {
  return (
    route.name === "videos" ||
    route.name === "videos-project" ||
    (route.name === "criativo-skill" && isVideoCreativeSkill(route.id)) ||
    (route.name === "criativo" && route.kind === "video")
  );
}

export function isCriativoGalleryRoute(route: AppRoute): boolean {
  return route.name === "criativo-gallery";
}

export function currentRoute(): AppRoute {
  return parsePath(window.location.pathname);
}

function sameRoute(a: AppRoute, b: AppRoute): boolean {
  if (a.name !== b.name) return false;
  if (a.name === "lead" && b.name === "lead") return a.id === b.id;
  if (a.name === "customer" && b.name === "customer") return a.id === b.id;
  if (a.name === "package" && b.name === "package") return a.id === b.id;
  if (a.name === "calendar-post" && b.name === "calendar-post") {
    return a.id === b.id;
  }
  if (a.name === "criativo" && b.name === "criativo") {
    return a.kind === b.kind;
  }
  if (a.name === "criativo-skill" && b.name === "criativo-skill") {
    return (
      a.id === b.id &&
      a.characterId === b.characterId &&
      a.movieId === b.movieId &&
      a.clipId === b.clipId
    );
  }
  if (a.name === "imagens-project" && b.name === "imagens-project") {
    return a.id === b.id;
  }
  if (a.name === "videos-project" && b.name === "videos-project") {
    return a.id === b.id;
  }
  if (a.name === "user" && b.name === "user") return a.id === b.id;
  return true;
}

function emit(route: AppRoute) {
  onChange(route);
  window.dispatchEvent(new CustomEvent<AppRoute>("app:navigated", { detail: route }));
}

export function navigate(
  route: AppRoute,
  options: { replace?: boolean } = {},
) {
  const href = hrefFor(route);
  const url = `${href}${window.location.search}`;
  const alreadyThere = window.location.pathname === href;
  if (!alreadyThere) {
    if (options.replace) {
      history.replaceState(null, "", url);
    } else {
      history.pushState(null, "", url);
    }
  }
  if (alreadyThere && sameRoute(currentRoute(), route) && started) {
    return;
  }
  emit(route);
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldIntercept(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
    return false;
  }
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.origin);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.endsWith(".html")) return false;
  return true;
}

export function startRouter(handler: (route: AppRoute) => void) {
  onChange = handler;
  if (started) {
    emit(currentRoute());
    return;
  }
  started = true;

  document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest("a");
    if (!anchor || !shouldIntercept(anchor, event)) return;
    const route = parsePath(new URL(anchor.href, window.location.origin).pathname);
    event.preventDefault();
    navigate(route);
  });

  window.addEventListener("popstate", () => {
    emit(currentRoute());
  });

  const initial = currentRoute();
  if (initial.name !== "not-found") {
    const href = hrefFor(initial);
    if (window.location.pathname !== href) {
      history.replaceState(
        null,
        "",
        `${href}${window.location.search}${window.location.hash}`,
      );
    }
  }
  emit(initial);
}
