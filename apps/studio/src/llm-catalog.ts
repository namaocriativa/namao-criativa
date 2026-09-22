export type LlmRole = "plan" | "code" | "vision" | "chat";

export type ModelChoice = {
  id: string;
  tags?: string[];
  roles?: LlmRole[];
};

export const CUSTOM_VALUE = "__custom__";

export const GEMINI_CATALOG: ModelChoice[] = [
  {
    id: "gemini-2.5-flash",
    tags: ["recomendado", "rápido", "visão"],
  },
  {
    id: "gemini-2.5-pro",
    tags: ["qualidade"],
    roles: ["plan", "code", "chat"],
  },
  { id: "gemini-2.5-flash-lite", tags: ["barato", "rápido"] },
  { id: "gemini-2.0-flash", tags: ["estável"] },
  { id: "gemini-2.0-flash-lite", tags: ["barato"] },
  { id: "gemini-1.5-flash" },
  { id: "gemini-1.5-pro" },
];

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function isRecommended(choice: ModelChoice, role: LlmRole): boolean {
  if (!choice.tags?.includes("recomendado")) return false;
  return !choice.roles || choice.roles.includes(role);
}

export function tagsFor(choice: ModelChoice | undefined, role: LlmRole): string[] {
  if (!choice?.tags?.length) return [];
  if (choice.roles && !choice.roles.includes(role)) {
    return choice.tags.filter((tag) => tag !== "recomendado");
  }
  return choice.tags;
}

export function findChoice(
  model: string,
  extra: Iterable<ModelChoice> = [],
): ModelChoice | undefined {
  return (
    GEMINI_CATALOG.find((item) => item.id === model) ||
    [...extra].find((item) => item.id === model)
  );
}

export function mergeModelChoices(liveIds: string[]): Map<string, ModelChoice> {
  const byId = new Map<string, ModelChoice>();
  for (const item of GEMINI_CATALOG) byId.set(item.id, item);
  for (const id of liveIds) {
    if (id && !byId.has(id)) byId.set(id, { id });
  }
  return byId;
}

export function partitionModelChoices(
  choices: Iterable<ModelChoice>,
  role: LlmRole,
): { recommended: ModelChoice[]; others: ModelChoice[] } {
  const recommended: ModelChoice[] = [];
  const others: ModelChoice[] = [];
  for (const item of choices) {
    if (isRecommended(item, role)) recommended.push(item);
    else others.push(item);
  }
  return { recommended, others };
}

export function readPickerModel(
  selectValue: string,
  customValue: string,
): string {
  if (selectValue === CUSTOM_VALUE) return customValue.trim();
  return selectValue.trim();
}

export function pickerState(
  model: string,
  knownIds: { has(id: string): boolean },
): { value: string; custom: string; known: boolean } {
  const current = model.trim();
  const known = Boolean(current) && knownIds.has(current);
  return {
    value: known ? current : CUSTOM_VALUE,
    custom: known ? "" : current,
    known,
  };
}

export function modelSelectHtml(
  role: LlmRole,
  liveIds: string[],
  selectedModel: string,
): { html: string; value: string; custom: string } {
  const byId = mergeModelChoices(liveIds);
  const { recommended, others } = partitionModelChoices(byId.values(), role);
  const current =
    selectedModel.trim() || recommended[0]?.id || others[0]?.id || "";
  const optionHtml = (item: ModelChoice) =>
    `<option value="${escapeAttr(item.id)}">${escapeAttr(item.id)}</option>`;
  const groups: string[] = [];
  if (recommended.length) {
    groups.push(
      `<optgroup label="Recomendados">${recommended.map(optionHtml).join("")}</optgroup>`,
    );
  }
  if (others.length) {
    groups.push(
      `<optgroup label="Outros">${others.map(optionHtml).join("")}</optgroup>`,
    );
  }
  groups.push(`<option value="${CUSTOM_VALUE}">Personalizado…</option>`);
  const state = pickerState(current, byId);
  return { html: groups.join(""), value: state.value, custom: state.custom };
}

export function modelTagsHtml(model: string, role: LlmRole): string {
  return tagsFor(findChoice(model), role)
    .map((tag) => {
      const best = tag === "recomendado" ? " config-model-tag--best" : "";
      return `<span class="config-model-tag${best}">${escapeAttr(tag)}</span>`;
    })
    .join("");
}
