import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  CUSTOM_SECTION_TYPE,
  PRESET_SECTIONS,
} from "./section-catalog";

export type NewSectionDraft = {
  type: string;
  title: string;
  description: string;
};

type AddSectionModalProps = {
  mode?: "create" | "edit";
  initial?: NewSectionDraft;
  onClose: () => void;
  onSubmit: (draft: NewSectionDraft) => void;
  onDelete?: () => void;
};

const TYPE_OPTIONS = [
  {
    type: CUSTOM_SECTION_TYPE,
    title: "Personalizada",
    description: "Diga o que esta seção deve comunicar, só com fatos do brief.",
  },
  ...PRESET_SECTIONS,
];

function defaultsFor(type: string): { title: string; description: string } {
  const match = TYPE_OPTIONS.find((item) => item.type === type);
  if (!match || type === CUSTOM_SECTION_TYPE) {
    return { title: "", description: "" };
  }
  return { title: match.title, description: match.description };
}

export function AddSectionModal({
  mode = "create",
  initial,
  onClose,
  onSubmit,
  onDelete,
}: AddSectionModalProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(initial?.type ?? CUSTOM_SECTION_TYPE);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const isEdit = mode === "edit";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  function handleType(next: string) {
    setType(next);
    const defaults = defaultsFor(next);
    setTitle(defaults.title);
    setDescription(defaults.description);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      type,
      title: nextTitle,
      description:
        description.trim() || defaultsFor(type).description || nextTitle,
    });
  }

  return createPortal(
    <div className="section-add-modal">
      <button
        type="button"
        className="section-add-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="section-add-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="section-add-modal__header">
          <h3 id={titleId}>{isEdit ? "Editar seção" : "Nova seção"}</h3>
          <button
            type="button"
            className="section-add-modal__close"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <form className="section-add-modal__form" onSubmit={handleSubmit}>
          <label className="site-wizard-field">
            Tipo
            <select
              value={type}
              onChange={(event) => handleType(event.target.value)}
            >
              {TYPE_OPTIONS.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="site-wizard-field">
            Título
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Horários, Equipe, Convênio"
              maxLength={80}
              required
            />
          </label>
          <label className="site-wizard-field">
            Descrição para a IA
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="O que esta seção deve comunicar, só com fatos do brief."
              rows={4}
            />
          </label>
          <div className="section-add-modal__actions">
            {onDelete ? (
              <button
                type="button"
                className="section-add-modal__delete"
                onClick={onDelete}
              >
                Remover
              </button>
            ) : (
              <button
                type="button"
                className="section-add-modal__cancel"
                onClick={onClose}
              >
                Cancelar
              </button>
            )}
            <button type="submit">{isEdit ? "Salvar" : "Adicionar"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
