import type {
  ComponentProps,
  StaticCode,
  UiComponentDefinition,
  UiComponentInstance,
} from "../types";

const STYLE_ID = "ui-lib-scroll-progress";
const ROOT_ATTR = "data-ui-scroll-progress";

const CSS = `[${ROOT_ATTR}] {
  position: fixed;
  left: 0;
  right: 0;
  height: var(--ui-sp-height, 2px);
  background: var(--ui-sp-track, transparent);
  z-index: var(--ui-sp-z, 60);
  pointer-events: none;
}

[${ROOT_ATTR}][data-position="top"] {
  top: 0;
}

[${ROOT_ATTR}][data-position="bottom"] {
  bottom: 0;
}

[${ROOT_ATTR}] > span {
  display: block;
  height: 100%;
  width: 100%;
  background: var(--ui-sp-color, #f2f2f2);
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}

[${ROOT_ATTR}][data-smooth="true"] > span {
  transition: transform 0.12s linear;
}

@media (prefers-reduced-motion: reduce) {
  [${ROOT_ATTR}] > span {
    transition: none;
  }
}`;

const RUNTIME_JS = `(function () {
  var root = document.querySelector('[${ROOT_ATTR}]');
  if (!root) return;
  var bar = root.firstElementChild;
  if (!bar) return;

  var frame = 0;
  function paint() {
    frame = 0;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = 'scaleX(' + ratio + ')';
  }
  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(paint);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  paint();
})();`;

interface ScrollProgressProps {
  color: string;
  cssVariable: string;
  trackColor: string;
  height: number;
  zIndex: number;
  position: string;
  smooth: boolean;
}

function read(props: ComponentProps): ScrollProgressProps {
  return {
    color: String(props.color),
    cssVariable: String(props.cssVariable),
    trackColor: String(props.trackColor),
    height: Number(props.height),
    zIndex: Number(props.zIndex),
    position: String(props.position),
    smooth: Boolean(props.smooth),
  };
}

/**
 * Prefere a CSS var do tema quando informada, caindo para a cor literal —
 * assim o mesmo componente segue a paleta da página ou usa um valor fixo.
 */
export function resolveBarColor(props: ScrollProgressProps): string {
  const name = props.cssVariable.trim();
  if (!name) return props.color;
  const variable = name.startsWith("--") ? name : `--${name}`;
  return `var(${variable}, ${props.color})`;
}

function styleDeclarations(props: ScrollProgressProps): Array<[string, string]> {
  return [
    ["--ui-sp-height", `${props.height}px`],
    ["--ui-sp-color", resolveBarColor(props)],
    ["--ui-sp-track", props.trackColor],
    ["--ui-sp-z", String(props.zIndex)],
  ];
}

function applyProps(root: HTMLElement, props: ScrollProgressProps): void {
  for (const [name, value] of styleDeclarations(props)) {
    root.style.setProperty(name, value);
  }
  root.dataset.position = props.position;
  root.dataset.smooth = String(props.smooth);
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function scrollRatio(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / max));
}

export const scrollProgressBar: UiComponentDefinition = {
  id: "scroll-progress",
  name: "Scroll Progress Bar",
  category: "Overlays",
  description:
    "Barra decorativa fixa no topo da viewport que cresce da esquerda para a direita conforme o scroll da página (0% no topo, 100% no fim do documento).",
  tags: ["scroll", "progresso", "fixo", "decorativo"],
  placement: "overlay",
  props: {
    color: {
      kind: "color",
      label: "Cor da barra",
      description: "Cor de preenchimento do progresso.",
      default: "#f2f2f2",
    },
    cssVariable: {
      kind: "text",
      label: "CSS var do tema",
      description:
        "Nome da CSS var usada como cor, com a cor literal como fallback (ex.: --fg). Vazio usa apenas a cor literal.",
      default: "--fg",
      placeholder: "--fg",
    },
    trackColor: {
      kind: "text",
      label: "Cor do trilho",
      description: "Fundo da faixa não preenchida. Use transparent para invisível.",
      default: "transparent",
      placeholder: "transparent",
    },
    height: {
      kind: "number",
      label: "Altura",
      description: "Espessura da barra em pixels.",
      default: 2,
      min: 1,
      max: 12,
      step: 1,
      unit: "px",
    },
    zIndex: {
      kind: "number",
      label: "z-index",
      description: "Deve ficar acima do header sticky da página.",
      default: 60,
      min: 1,
      max: 9999,
      step: 1,
    },
    position: {
      kind: "select",
      label: "Posição",
      description: "Borda da viewport onde a barra fica fixa.",
      default: "top",
      options: [
        { value: "top", label: "Topo" },
        { value: "bottom", label: "Rodapé" },
      ],
    },
    smooth: {
      kind: "boolean",
      label: "Transição suave",
      description:
        "Suaviza o avanço da barra. Ignorado quando o usuário pede menos movimento.",
      default: true,
    },
  },

  mount(props: ComponentProps): UiComponentInstance {
    injectStyle();

    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "");
    root.setAttribute("aria-hidden", "true");

    const bar = document.createElement("span");
    root.appendChild(bar);
    applyProps(root, read(props));
    document.body.appendChild(root);

    let frame = 0;
    const paint = () => {
      frame = 0;
      bar.style.transform = `scaleX(${scrollRatio()})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // A altura do documento muda ao trocar de aba, então o progresso precisa
    // ser recalculado mesmo sem scroll do usuário.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    paint();

    return {
      element: root,
      update(next: ComponentProps) {
        applyProps(root, read(next));
        schedule();
      },
      destroy() {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        observer.disconnect();
        if (frame) window.cancelAnimationFrame(frame);
        root.remove();
      },
    };
  },

  toStaticCode(props: ComponentProps): StaticCode {
    const resolved = read(props);
    const inlineStyle = styleDeclarations(resolved)
      .map(([name, value]) => `${name}: ${value}`)
      .join("; ");

    return {
      html: `<div ${ROOT_ATTR} aria-hidden="true" data-position="${resolved.position}" data-smooth="${resolved.smooth}" style="${inlineStyle}"><span></span></div>`,
      css: CSS,
      js: RUNTIME_JS,
    };
  },
};
