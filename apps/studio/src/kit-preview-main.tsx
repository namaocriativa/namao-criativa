import { createRoot } from "react-dom/client";
import {
  isComponentId,
  previewPageSpec,
  resolveTheme,
  type ComponentId,
} from "@namao/landing-kit";
import {
  LandingPage,
  ReducedMotionProvider,
} from "@namao/landing-kit/renderer";
import "@namao/landing-kit/styles.css";
import "@namao/landing-kit/theme.css";

const params = new URLSearchParams(window.location.search);
const rawId = params.get("id") || "hero.cinematic";
const id: ComponentId = isComponentId(rawId) ? rawId : "hero.cinematic";
const dark = params.get("dark") === "1";
const reduced = params.get("reduced") === "1";
const spec = previewPageSpec(id, dark);
const themeCss = resolveTheme(spec.theme).cssVariables;

const style = document.createElement("style");
style.textContent = themeCss;
document.head.appendChild(style);

const root = document.getElementById("root");
if (!root) throw new Error("#root ausente no preview");

createRoot(root).render(
  <ReducedMotionProvider value={reduced}>
    <LandingPage spec={spec} />
  </ReducedMotionProvider>,
);
