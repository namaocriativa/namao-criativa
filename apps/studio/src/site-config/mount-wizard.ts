import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@puckeditor/core/puck.css";
import { SiteWizardModal } from "./SiteWizardModal";
import {
  defaultGeneratePayload,
  type GeneratePayload,
} from "./wizard-payload";

export { openSiteWizard, closeSiteWizard } from "./SiteWizardModal";

let root: Root | null = null;
let latest: GeneratePayload = defaultGeneratePayload();
let confirmHandler: (() => void) | null = null;
let wizardLeadId: string | null = null;

export function setWizardLeadId(id: string | null): void {
  wizardLeadId = id;
}

export function getWizardLeadId(): string | null {
  return wizardLeadId;
}

export function mountSiteWizard(host: HTMLElement): void {
  if (root) {
    root.unmount();
    root = null;
  }
  root = createRoot(host);
  root.render(
    createElement(SiteWizardModal, {
      onChange: (payload) => {
        latest = payload;
      },
      onConfirm: () => {
        confirmHandler?.();
      },
    }),
  );
}

export function setWizardOnConfirm(handler: () => void): void {
  confirmHandler = handler;
}

export function getGeneratePayload(): GeneratePayload {
  return latest;
}
