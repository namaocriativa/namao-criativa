/**
 * Contratos da UI Lib.
 *
 * Cada componente é descrito por um schema de props (o que o Ollama lê para
 * saber como customizá-lo) e por duas formas de renderização:
 * - `mount`: instancia o componente vivo no DOM desta página (playground/app);
 * - `toStaticCode`: emite HTML/CSS/JS puros, sem dependências, para serem
 *   injetados em páginas geradas.
 */

export type PropValue = string | number | boolean;

export type ComponentProps = Record<string, PropValue>;

interface BasePropSchema {
  label: string;
  description: string;
}

export interface ColorPropSchema extends BasePropSchema {
  kind: "color";
  default: string;
}

export interface NumberPropSchema extends BasePropSchema {
  kind: "number";
  default: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface BooleanPropSchema extends BasePropSchema {
  kind: "boolean";
  default: boolean;
}

export interface TextPropSchema extends BasePropSchema {
  kind: "text";
  default: string;
  placeholder?: string;
}

export interface SelectPropSchema extends BasePropSchema {
  kind: "select";
  default: string;
  options: Array<{ value: string; label: string }>;
}

export type PropSchema =
  | ColorPropSchema
  | NumberPropSchema
  | BooleanPropSchema
  | TextPropSchema
  | SelectPropSchema;

export type PropsSchema = Record<string, PropSchema>;

/** Código autocontido de um componente, pronto para uma página gerada. */
export interface StaticCode {
  html: string;
  css: string;
  js: string;
}

export interface UiComponentInstance {
  element: HTMLElement;
  update(props: ComponentProps): void;
  destroy(): void;
}

export interface UiComponentDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  /**
   * `overlay`: o componente se posiciona sozinho na viewport e é anexado ao
   * body. `inline`: renderiza dentro do container informado em `mount`.
   */
  placement: "overlay" | "inline";
  props: PropsSchema;
  mount(props: ComponentProps, host?: HTMLElement): UiComponentInstance;
  toStaticCode(props: ComponentProps): StaticCode;
}

/** Instrução que o Ollama emite para usar um componente na página. */
export interface ComponentSpec {
  component: string;
  props?: ComponentProps;
}

export interface ManifestProp {
  type: PropSchema["kind"];
  default: PropValue;
  description: string;
  min?: number;
  max?: number;
  unit?: string;
  options?: string[];
}

export interface ComponentManifest {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  placement: UiComponentDefinition["placement"];
  props: Record<string, ManifestProp>;
  example: ComponentSpec;
}

export interface UiLibManifest {
  version: number;
  components: ComponentManifest[];
}
