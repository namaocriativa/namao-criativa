export type AppRoute =
  | { name: "leads" }
  | { name: "lead"; id: string }
  | { name: "customers" }
  | { name: "customer"; id: string }
  | { name: "discovery" }
  | { name: "enrichment" }
  | { name: "packages" }
  | { name: "package"; id: string }
  | { name: "ui-lib" }
  | { name: "config" }
  | { name: "users" }
  | { name: "not-found" };

const APP_TITLE = "Lead Discovery Enrichment";

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
  if (path === "/ui-lib") return { name: "ui-lib" };
  if (path === "/config") return { name: "config" };
  if (path === "/users") return { name: "users" };
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
    case "ui-lib":
      return "/ui-lib";
    case "config":
      return "/config";
    case "users":
      return "/users";
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
    case "ui-lib":
      return "ui-lib";
    case "config":
      return "config";
    case "users":
      return "users";
    case "not-found":
      return "not-found";
  }
}

export function navRouteFor(route: AppRoute): string | null {
  if (route.name === "not-found") return null;
  if (route.name === "lead") return "leads";
  if (route.name === "customer") return "customers";
  if (route.name === "package") return "packages";
  return route.name;
}

export function titleForRoute(route: AppRoute, leadName?: string): string {
  switch (route.name) {
    case "leads":
      return `Leads · ${APP_TITLE}`;
    case "lead":
      return `${leadName || "Lead"} · ${APP_TITLE}`;
    case "customers":
      return `Customers · ${APP_TITLE}`;
    case "customer":
      return `${leadName || "Customer"} · ${APP_TITLE}`;
    case "discovery":
      return `Discovery · ${APP_TITLE}`;
    case "enrichment":
      return `Enrichment · ${APP_TITLE}`;
    case "packages":
      return `Pacotes · ${APP_TITLE}`;
    case "package":
      return `${leadName || "Pacote"} · ${APP_TITLE}`;
    case "ui-lib":
      return `UI Lib · ${APP_TITLE}`;
    case "config":
      return `Config · ${APP_TITLE}`;
    case "users":
      return `Usuários · ${APP_TITLE}`;
    case "not-found":
      return `Não encontrado · ${APP_TITLE}`;
  }
}

export function currentRoute(): AppRoute {
  return parsePath(window.location.pathname);
}

function sameRoute(a: AppRoute, b: AppRoute): boolean {
  if (a.name !== b.name) return false;
  if (a.name === "lead" && b.name === "lead") return a.id === b.id;
  if (a.name === "customer" && b.name === "customer") return a.id === b.id;
  if (a.name === "package" && b.name === "package") return a.id === b.id;
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
