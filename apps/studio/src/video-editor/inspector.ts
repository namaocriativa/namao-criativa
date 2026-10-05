import type { EditDocumentStore, EditFit } from "./document";
import {
  TEXT_FONTS,
  type ClipTextStyle,
  type TextAlign,
  type TextBackground,
  type TextFontId,
} from "./text-styles";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initInspector(opts: {
  root: HTMLElement;
  store: EditDocumentStore;
}) {
  const { root, store } = opts;
  let renderedKey = "";

  function render() {
    const { selection, document: doc } = store.getState();
    const selectionKey = `${selection.trackId || ""}:${selection.clipId || ""}`;
    const editing =
      root.contains(document.activeElement) && document.activeElement !== root;
    if (editing && selectionKey === renderedKey) return;
    renderedKey = selectionKey;
    if (!selection.trackId || !selection.clipId) {
      root.innerHTML = `
        <h3>Propriedades</h3>
        <p class="prompt-hint">Selecione um clipe na timeline.</p>
        <div class="ve-inspector-section">
          <h4>Projeto</h4>
          <label class="ve-field">Proporção do canvas
            <select id="ve-canvas-preset">
              <option value="9:16" ${doc.canvas.width < doc.canvas.height ? "selected" : ""}>9:16</option>
              <option value="16:9" ${doc.canvas.width > doc.canvas.height ? "selected" : ""}>16:9</option>
              <option value="1:1" ${doc.canvas.width === doc.canvas.height ? "selected" : ""}>1:1</option>
            </select>
          </label>
        </div>`;
      root.querySelector("#ve-canvas-preset")?.addEventListener("change", (e) => {
        store.setCanvasPreset(
          (e.target as HTMLSelectElement).value as "9:16" | "16:9" | "1:1",
        );
      });
      return;
    }

    const found = store.findClipAt(selection.trackId, selection.clipId);
    if (!found) {
      root.innerHTML = `<h3>Propriedades</h3><p class="prompt-hint">Clipe não encontrado.</p>`;
      return;
    }
    const { track, clip } = found;
    const fit = clip.transform?.fit || "contain";
    const isText = clip.media.kind === "text" && clip.text;
    const text = clip.text;

    root.innerHTML = `
      <h3>Propriedades</h3>
      <p class="ve-inspector-title">${escapeHtml(clip.media.label || clip.media.kind)}</p>
      <p class="prompt-hint">${escapeHtml(track.type)} · ${escapeHtml(clip.media.kind)}</p>
      ${
        isText && text
          ? `
      <label class="ve-field">Texto
        <textarea id="ve-text-body" rows="3">${escapeHtml(text.body)}</textarea>
      </label>
      <label class="ve-field">Estilo
        <select id="ve-text-font">
          ${TEXT_FONTS.map(
            (font) =>
              `<option value="${font.id}" ${text.fontId === font.id ? "selected" : ""}>${escapeHtml(font.label)}</option>`,
          ).join("")}
        </select>
      </label>
      <label class="ve-field">Cor
        <input type="color" id="ve-text-color" value="${escapeHtml(text.color)}" />
      </label>
      <label class="ve-field">Alinhamento
        <select id="ve-text-align">
          <option value="left" ${text.align === "left" ? "selected" : ""}>Esquerda</option>
          <option value="center" ${text.align === "center" ? "selected" : ""}>Centro</option>
          <option value="right" ${text.align === "right" ? "selected" : ""}>Direita</option>
        </select>
      </label>
      <label class="ve-field">Fundo
        <select id="ve-text-bg">
          <option value="none" ${text.background === "none" ? "selected" : ""}>Nenhum</option>
          <option value="highlight" ${text.background === "highlight" ? "selected" : ""}>Destaque</option>
          <option value="solid" ${text.background === "solid" ? "selected" : ""}>Caixa</option>
        </select>
      </label>
      <label class="ve-field">Posição X
        <input type="range" id="ve-text-x" min="-400" max="400" step="4" value="${clip.transform?.x ?? 0}" />
      </label>
      <label class="ve-field">Posição Y
        <input type="range" id="ve-text-y" min="-600" max="600" step="4" value="${clip.transform?.y ?? 0}" />
      </label>`
          : `
      <label class="ve-field">Volume
        <input type="range" id="ve-clip-volume" min="0" max="1" step="0.05" value="${clip.volume}" />
      </label>
      <label class="ve-check"><input type="checkbox" id="ve-clip-muted" ${clip.muted ? "checked" : ""} /> Silenciar clipe</label>
      <label class="ve-check"><input type="checkbox" id="ve-track-muted" ${track.muted ? "checked" : ""} /> Silenciar faixa</label>
      <label class="ve-field">Enquadramento
        <select id="ve-clip-fit">
          <option value="contain" ${fit === "contain" ? "selected" : ""}>Contain</option>
          <option value="cover" ${fit === "cover" ? "selected" : ""}>Cover</option>
          <option value="stretch" ${fit === "stretch" ? "selected" : ""}>Stretch</option>
        </select>
      </label>`
      }
      <label class="ve-field">Escala
        <input type="range" id="ve-clip-scale" min="0.2" max="3" step="0.05" value="${clip.transform?.scale ?? 1}" />
      </label>
      <div class="ve-inspector-actions">
        <button type="button" class="outline" id="ve-clip-split">Dividir no playhead</button>
        <button type="button" class="outline danger" id="ve-clip-remove">Remover</button>
      </div>
    `;

    const patchTransform = (partial: {
      x?: number;
      y?: number;
      scale?: number;
      fit?: EditFit;
    }) => {
      const current = store.findClipAt(track.id, clip.id)?.clip;
      store.updateClip(
        track.id,
        clip.id,
        {
          transform: {
            x: partial.x ?? current?.transform?.x ?? 0,
            y: partial.y ?? current?.transform?.y ?? 0,
            scale: partial.scale ?? current?.transform?.scale ?? 1,
            fit: partial.fit ?? current?.transform?.fit ?? "contain",
          },
        },
        { history: false },
      );
    };

    const patchText = (partial: Partial<ClipTextStyle>, history = false) => {
      const current = store.findClipAt(track.id, clip.id)?.clip?.text;
      if (!current) return;
      store.updateClip(
        track.id,
        clip.id,
        { text: { ...current, ...partial } },
        { history },
      );
    };

    root.querySelector("#ve-text-body")?.addEventListener("focus", () => {
      store.beginHistoryCheckpoint();
    });
    root.querySelector("#ve-text-body")?.addEventListener("input", (e) => {
      patchText({ body: (e.target as HTMLTextAreaElement).value });
    });
    root.querySelector("#ve-text-font")?.addEventListener("change", (e) => {
      patchText(
        { fontId: (e.target as HTMLSelectElement).value as TextFontId },
        true,
      );
    });
    root.querySelector("#ve-text-color")?.addEventListener("input", (e) => {
      patchText({ color: (e.target as HTMLInputElement).value });
    });
    root.querySelector("#ve-text-align")?.addEventListener("change", (e) => {
      patchText(
        { align: (e.target as HTMLSelectElement).value as TextAlign },
        true,
      );
    });
    root.querySelector("#ve-text-bg")?.addEventListener("change", (e) => {
      patchText(
        { background: (e.target as HTMLSelectElement).value as TextBackground },
        true,
      );
    });
    root.querySelector("#ve-text-x")?.addEventListener("input", (e) => {
      patchTransform({ x: Number((e.target as HTMLInputElement).value) });
    });
    root.querySelector("#ve-text-y")?.addEventListener("input", (e) => {
      patchTransform({ y: Number((e.target as HTMLInputElement).value) });
    });

    root.querySelector("#ve-clip-volume")?.addEventListener("input", (e) => {
      store.updateClip(track.id, clip.id, {
        volume: Number((e.target as HTMLInputElement).value),
      });
    });
    root.querySelector("#ve-clip-muted")?.addEventListener("change", (e) => {
      store.updateClip(track.id, clip.id, {
        muted: (e.target as HTMLInputElement).checked,
      });
    });
    root.querySelector("#ve-track-muted")?.addEventListener("change", (e) => {
      store.updateTrack(track.id, {
        muted: (e.target as HTMLInputElement).checked,
      });
    });
    root.querySelector("#ve-clip-fit")?.addEventListener("change", (e) => {
      const nextFit = (e.target as HTMLSelectElement).value as EditFit;
      store.updateClip(track.id, clip.id, {
        transform: {
          x: clip.transform?.x ?? 0,
          y: clip.transform?.y ?? 0,
          scale: clip.transform?.scale ?? 1,
          fit: nextFit,
        },
      });
    });
    root.querySelector("#ve-clip-scale")?.addEventListener("input", (e) => {
      patchTransform({
        scale: Number((e.target as HTMLInputElement).value),
      });
    });
    root.querySelector("#ve-clip-split")?.addEventListener("click", () => {
      store.splitClipAtPlayhead();
    });
    root.querySelector("#ve-clip-remove")?.addEventListener("click", () => {
      store.removeClip(track.id, clip.id);
    });
  }

  store.subscribe(render);
  render();
  return { render };
}
