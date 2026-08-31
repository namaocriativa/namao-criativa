import { Puck, useGetPuck, type Data } from "@puckeditor/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { AddSectionModal, type NewSectionDraft } from "./AddSectionModal";
import {
  defaultPuckData,
  puckDataToSections,
  sectionPuckConfig,
  sectionsToPuckData,
} from "./puck-config";
import {
  CUSTOM_SECTION_TYPE,
  slugifySectionId,
  uniqueSectionId,
  type LandingSectionConfig,
} from "./section-catalog";

type SectionComposerProps = {
  onChange: (sections: LandingSectionConfig[]) => void;
  initialSections?: LandingSectionConfig[];
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; index: number; id: string; initial: NewSectionDraft };

function ComposerStage({ count }: { count: number }) {
  const getPuck = useGetPuck();
  const pointer = useRef({ x: 0, y: 0, dragging: false });
  const [editor, setEditor] = useState<EditorState | null>(null);

  function closeEditor() {
    setEditor(null);
  }

  function addSection(draft: NewSectionDraft) {
    const puck = getPuck();
    puck.dispatch({
      type: "setData",
      recordHistory: true,
      data: (previous) => {
        const content = previous.content || [];
        const used = new Set(
          content
            .map((item) => String(item.props?.id || "").trim())
            .filter(Boolean),
        );
        const preferred =
          draft.type === CUSTOM_SECTION_TYPE
            ? slugifySectionId(draft.title)
            : draft.type;
        return {
          content: [
            ...content,
            {
              type: draft.type,
              props: {
                id: uniqueSectionId(preferred, used),
                title: draft.title,
                description: draft.description,
              },
            },
          ],
        };
      },
    });
    closeEditor();
  }

  function saveSection(draft: NewSectionDraft) {
    if (editor?.mode !== "edit") return;
    const { index, id } = editor;
    getPuck().dispatch({
      type: "setData",
      recordHistory: true,
      data: (previous) => ({
        content: (previous.content || []).map((item, i) =>
          i === index
            ? {
                type: draft.type,
                props: {
                  id,
                  title: draft.title,
                  description: draft.description,
                },
              }
            : item,
        ),
      }),
    });
    closeEditor();
  }

  function deleteSection() {
    if (editor?.mode !== "edit") return;
    const { index } = editor;
    getPuck().dispatch({
      type: "setData",
      recordHistory: true,
      data: (previous) => ({
        content: (previous.content || []).filter((_, i) => i !== index),
      }),
    });
    closeEditor();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointer.current = { x: event.clientX, y: event.clientY, dragging: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current.dragging) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    if (Math.hypot(dx, dy) > 8) pointer.current.dragging = true;
  }

  function onListClick(event: MouseEvent<HTMLDivElement>) {
    if (pointer.current.dragging) return;
    const node = (event.target as HTMLElement | null)?.closest(
      "[data-puck-component]",
    );
    if (!(node instanceof HTMLElement)) return;
    const puck = getPuck();
    const content = puck.appState.data.content || [];
    const dndId = node.getAttribute("data-puck-dnd") || "";
    const parent = node.parentElement;
    const siblingIndex = parent
      ? [...parent.children].indexOf(node)
      : -1;
    let index = dndId
      ? content.findIndex((item) => String(item.props?.id || "") === dndId)
      : -1;
    if (index < 0) index = siblingIndex;
    if (index < 0 || !content[index]) return;
    const item = content[index];
    setEditor({
      mode: "edit",
      index,
      id: String(item.props?.id || dndId),
      initial: {
        type: String(item.type || CUSTOM_SECTION_TYPE),
        title: String(item.props?.title || ""),
        description: String(item.props?.description || ""),
      },
    });
  }

  return (
    <div className="section-composer__stage">
      <p className="section-composer__label">Ordem na landing ({count})</p>
      <div
        className="section-composer__list"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onClickCapture={onListClick}
      >
        <Puck.Preview />
      </div>
      <button
        type="button"
        className="section-composer__add"
        onClick={() => setEditor({ mode: "create" })}
      >
        <span aria-hidden="true">+</span>
        Adicionar seção
      </button>
      {editor ? (
        <AddSectionModal
          key={editor.mode === "edit" ? `edit-${editor.index}` : "create"}
          mode={editor.mode}
          initial={editor.mode === "edit" ? editor.initial : undefined}
          onClose={closeEditor}
          onSubmit={editor.mode === "edit" ? saveSection : addSection}
          onDelete={editor.mode === "edit" ? deleteSection : undefined}
        />
      ) : null}
    </div>
  );
}

export function SectionComposer({
  onChange,
  initialSections,
}: SectionComposerProps) {
  const initial = useMemo(
    () =>
      initialSections?.length
        ? sectionsToPuckData(initialSections)
        : defaultPuckData(),
    // Capture the outline once when the wizard session mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [count, setCount] = useState(initial.content?.length || 0);

  useEffect(() => {
    onChange(puckDataToSections(initial));
    // Emit the default outline once; later updates come from Puck.onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="section-composer">
      <Puck
        config={sectionPuckConfig}
        data={initial}
        iframe={{ enabled: false }}
        height="auto"
        onChange={(data: Data) => {
          const sections = puckDataToSections(data);
          setCount(sections.length);
          onChange(sections);
        }}
      >
        <ComposerStage count={count} />
      </Puck>
    </div>
  );
}
