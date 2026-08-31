import { useEffect, useState } from "react";
import { SiteGenerateWizard } from "./SiteGenerateWizard";
import type { GeneratePayload } from "./wizard-payload";

const OPEN_WIZARD_EVENT = "namao:open-site-wizard";
const CLOSE_WIZARD_EVENT = "namao:close-site-wizard";

export function openSiteWizard(): void {
  window.dispatchEvent(new Event(OPEN_WIZARD_EVENT));
}

export function closeSiteWizard(): void {
  window.dispatchEvent(new Event(CLOSE_WIZARD_EVENT));
}

type SiteWizardModalProps = {
  onChange: (payload: GeneratePayload) => void;
  onConfirm: () => void;
};

export function SiteWizardModal({
  onChange,
  onConfirm,
}: SiteWizardModalProps) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const onOpen = () => {
      setSession((current) => current + 1);
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    window.addEventListener(CLOSE_WIZARD_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);
      window.removeEventListener(CLOSE_WIZARD_EVENT, onClose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="site-wizard-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-wizard-title"
    >
      <button
        type="button"
        className="site-wizard-modal__backdrop"
        aria-label="Fechar wizard"
        onClick={() => setOpen(false)}
      />
      <div className="site-wizard-modal__dialog">
        <SiteGenerateWizard
          key={session}
          onChange={onChange}
          onClose={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            onConfirm();
          }}
        />
      </div>
    </div>
  );
}
