import type { Lead } from "./types";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function field(form: HTMLFormElement, name: string): HTMLInputElement {
  const node = form.elements.namedItem(name);
  if (!(node instanceof HTMLInputElement)) {
    throw new Error(`Campo ${name} não encontrado`);
  }
  return node;
}

export function initLeadEditModal(
  host: HTMLElement,
  options: { onSaved: (lead: Lead) => void },
): {
  open: (lead: Lead) => void;
  close: () => void;
} {
  let lead: Lead | null = null;
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal lead-edit-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-edit-close
        aria-label="Fechar edição"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-edit-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-edit-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Resumo do lead</p>
            <h3 id="lead-edit-title">Editar informações</h3>
          </div>
          <button type="button" class="outline" data-edit-close>Fechar</button>
        </header>
        <form class="lead-edit-form" data-edit-form>
          <label>
            Cidade
            <input name="city" maxlength="120" autocomplete="address-level2" />
          </label>
          <label>
            UF
            <input name="state" maxlength="8" autocomplete="address-level1" />
          </label>
          <label>
            Telefone
            <input name="phone" maxlength="40" autocomplete="tel" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" maxlength="320" autocomplete="email" />
          </label>
          <label>
            Website
            <input name="website" maxlength="500" autocomplete="url" />
          </label>
          <label>
            Instagram
            <input name="instagram" maxlength="200" autocomplete="off" placeholder="@conta ou URL" />
          </label>
          <div class="lead-edit-actions">
            <button type="submit" data-edit-save>Salvar</button>
            <button type="button" class="secondary" data-edit-close>Cancelar</button>
          </div>
        </form>
        <p class="status" data-edit-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-edit-modal")!;
  const form = host.querySelector<HTMLFormElement>("[data-edit-form]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-edit-status]")!;
  const saveBtn = host.querySelector<HTMLButtonElement>("[data-edit-save]")!;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function fill(next: Lead) {
    field(form, "city").value = next.city || "";
    field(form, "state").value = next.state || "";
    field(form, "phone").value = next.phone || "";
    field(form, "email").value = next.email || "";
    field(form, "website").value = next.website || "";
    field(form, "instagram").value = next.instagram || "";
  }

  function close() {
    if (busy) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
    lead = null;
  }

  function open(next: Lead) {
    if (!next.id) return;
    lead = next;
    fill(next);
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    field(form, "city").focus();
  }

  async function save(event: Event) {
    event.preventDefault();
    if (!lead?.id || busy) return;
    busy = true;
    saveBtn.disabled = true;
    setStatus("Salvando…");
    try {
      const res = await fetch(`/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: field(form, "city").value.trim() || null,
          state: field(form, "state").value.trim() || null,
          phone: field(form, "phone").value.trim() || null,
          email: field(form, "email").value.trim() || null,
          website: field(form, "website").value.trim() || null,
          instagram: field(form, "instagram").value.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || "Falha ao salvar lead";
        throw new Error(msg);
      }
      const saved = data as Lead;
      busy = false;
      close();
      options.onSaved(saved);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar lead"), true);
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  }

  host.addEventListener("click", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-edit-close]")) {
      close();
    }
  });
  host.querySelectorAll("[data-edit-close]").forEach((node) => {
    node.addEventListener("click", () => close());
  });
  form.addEventListener("submit", (event) => {
    void save(event);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  return { open, close };
}
