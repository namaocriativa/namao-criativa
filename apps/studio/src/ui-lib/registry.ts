import type {
  ComponentManifest,
  ComponentProps,
  ComponentSpec,
  ManifestProp,
  PropSchema,
  PropValue,
  StaticCode,
  UiComponentDefinition,
  UiComponentInstance,
  UiLibManifest,
} from "./types";

export const MANIFEST_VERSION = 1;

const registry = new Map<string, UiComponentDefinition>();

export function registerComponent(definition: UiComponentDefinition): void {
  if (registry.has(definition.id)) {
    throw new Error(`Componente duplicado na UI Lib: ${definition.id}`);
  }
  registry.set(definition.id, definition);
}

export function listComponents(): UiComponentDefinition[] {
  return [...registry.values()];
}

export function getComponent(id: string): UiComponentDefinition | undefined {
  return registry.get(id);
}

function requireComponent(id: string): UiComponentDefinition {
  const definition = registry.get(id);
  if (!definition) {
    const known = [...registry.keys()].join(", ") || "nenhum";
    throw new Error(`Componente "${id}" não existe na UI Lib. Disponíveis: ${known}`);
  }
  return definition;
}

export function defaultProps(definition: UiComponentDefinition): ComponentProps {
  const props: ComponentProps = {};
  for (const [name, schema] of Object.entries(definition.props)) {
    props[name] = schema.default;
  }
  return props;
}

function coerce(schema: PropSchema, value: PropValue): PropValue {
  switch (schema.kind) {
    case "number": {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return schema.default;
      return Math.min(schema.max, Math.max(schema.min, parsed));
    }
    case "boolean":
      return typeof value === "boolean" ? value : value === "true" || value === 1;
    case "select": {
      const candidate = String(value);
      const allowed = schema.options.some((option) => option.value === candidate);
      return allowed ? candidate : schema.default;
    }
    case "color":
    case "text":
      return String(value).trim() || schema.default;
  }
}

/**
 * Completa props parciais (vindas do playground ou do Gemini) com os defaults,
 * descartando chaves desconhecidas e valores fora dos limites do schema.
 */
export function resolveProps(
  definition: UiComponentDefinition,
  partial?: ComponentProps,
): ComponentProps {
  const resolved = defaultProps(definition);
  if (!partial) return resolved;

  for (const [name, value] of Object.entries(partial)) {
    const schema = definition.props[name];
    if (!schema || value === null || value === undefined) continue;
    resolved[name] = coerce(schema, value);
  }
  return resolved;
}

function toManifestProp(schema: PropSchema): ManifestProp {
  const base: ManifestProp = {
    type: schema.kind,
    default: schema.default,
    description: schema.description,
  };
  if (schema.kind === "number") {
    base.min = schema.min;
    base.max = schema.max;
    if (schema.unit) base.unit = schema.unit;
  }
  if (schema.kind === "select") {
    base.options = schema.options.map((option) => option.value);
  }
  return base;
}

function toComponentManifest(definition: UiComponentDefinition): ComponentManifest {
  const props: Record<string, ManifestProp> = {};
  for (const [name, schema] of Object.entries(definition.props)) {
    props[name] = toManifestProp(schema);
  }
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    tags: definition.tags,
    placement: definition.placement,
    props,
    example: { component: definition.id, props: defaultProps(definition) },
  };
}

/** Catálogo legível por máquina — é o que se injeta no prompt do Gemini. */
export function buildManifest(): UiLibManifest {
  return {
    version: MANIFEST_VERSION,
    components: listComponents().map(toComponentManifest),
  };
}

/** Aplica uma spec do Gemini nesta página. */
export function mountSpec(spec: ComponentSpec, host?: HTMLElement): UiComponentInstance {
  const definition = requireComponent(spec.component);
  return definition.mount(resolveProps(definition, spec.props), host);
}

/** Converte uma spec do Gemini em código estático para páginas geradas. */
export function renderSpec(spec: ComponentSpec): StaticCode {
  const definition = requireComponent(spec.component);
  return definition.toStaticCode(resolveProps(definition, spec.props));
}
