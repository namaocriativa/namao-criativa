import { scrollProgressBar } from "./components/scroll-progress";
import { registerComponent } from "./registry";

registerComponent(scrollProgressBar);

export {
  buildManifest,
  defaultProps,
  getComponent,
  listComponents,
  mountSpec,
  renderSpec,
  resolveProps,
  MANIFEST_VERSION,
} from "./registry";

export type {
  ComponentProps,
  ComponentSpec,
  PropSchema,
  StaticCode,
  UiComponentDefinition,
  UiComponentInstance,
  UiLibManifest,
} from "./types";
