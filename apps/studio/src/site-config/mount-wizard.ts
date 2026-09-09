import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@puckeditor/core/puck.css";
import { profileApi, type EntityKind } from "../profile-api";
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
let wizardApiKind: EntityKind = "lead";

export function setWizardLeadId(id: string | null): void {
  wizardLeadId = id;
}

export function getWizardLeadId(): string | null {
  return wizardLeadId;
}

export function setWizardApiKind(kind: EntityKind): void {
  wizardApiKind = kind;
}

export function getWizardApiKind(): EntityKind {
  return wizardApiKind;
}

export function wizardProfileApi(id: string, suffix = ""): string {
  return profileApi(wizardApiKind, id, suffix);
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
