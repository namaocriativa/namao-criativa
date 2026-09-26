import type { Lead, LeadImage } from "./types";
import { api } from "./api";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function linkOrText(value: unknown): string {
  const text = String(value);
  if (/^https?:\/\//i.test(text) || text.startsWith("www.")) {
    const href = text.startsWith("www.") ? `https://${text}` : text;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  if (text.startsWith("@")) {
    const handle = text.replace(/^@/, "");
    return `<a href="https://www.instagram.com/${escapeHtml(handle)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  if (text.includes("@") && text.includes(".")) {
    return `<a href="mailto:${escapeHtml(text)}">${escapeHtml(text)}</a>`;
  }
  return escapeHtml(text);
}

function displayValue(value: unknown): string {
  if (!hasValue(value)) return `<span class="missing">—</span>`;
  const display = Array.isArray(value) ? value.join(", ") : value;
  return linkOrText(display);
}

function imageSrc(img: LeadImage): string {
  return `/${img.localPath.replace(/^\/+/, "")}`;
}

function isInstagramImage(img: LeadImage): boolean {
  const source = (img.source || "").toLowerCase();
  const url = (img.sourceUrl || "").toLowerCase();
  return (
    source === "instagram" ||
    url.includes("instagram.com") ||
    url.includes("cdninstagram.com")
  );
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

function item(label: string, value: unknown): string {
  return `<div class="lead-ficha-item">
    <dt>${escapeHtml(label)}</dt>
    <dd>${displayValue(value)}</dd>
  </div>`;
}

function photoMeta(img: LeadImage): string {
  const rows: Array<[string, string]> = [];
  if (img.source) rows.push(["Fonte", img.source]);
  if (img.sourceUrl) rows.push(["URL original", img.sourceUrl]);
  if (img.filename) rows.push(["Arquivo", img.filename]);
  if (img.mimeType) rows.push(["Tipo", img.mimeType]);
  if (img.width || img.height) {
    rows.push(["Dimensões", `${img.width || "?"} × ${img.height || "?"}`]);
  }
  if (img.createdAt) rows.push(["Capturada", formatDate(img.createdAt)]);
  if (!rows.length) rows.push(["Metadados", "Não disponíveis"]);
  return rows
    .map(
      ([label, value]) =>
        `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
}

export function initLeadFichaModal(host: HTMLElement): {
  open: (lead: Lead) => void;
  close: () => void;
  sync: (lead: Lead) => void;
} {
  let lead: Lead | null = null;
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal lead-ficha-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-ficha-close
        aria-label="Fechar ficha"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-ficha-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-ficha-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker" data-ficha-kicker>Ficha cadastral</p>
            <h3 id="lead-ficha-title">Lead</h3>
          </div>
          <button type="button" class="outline" data-ficha-close>Fechar</button>
        </header>
        <div class="lead-ficha-body" data-ficha-body></div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-ficha-modal")!;
  const title = host.querySelector<HTMLElement>("#lead-ficha-title")!;
  const kicker = host.querySelector<HTMLElement>("[data-ficha-kicker]")!;
  const body = host.querySelector<HTMLElement>("[data-ficha-body]")!;

  function render() {
    if (!lead) {
      body.innerHTML = "";
      return;
    }
    const isCustomer = lead._entityKind === "customer";
    const place =
      lead.city && lead.state
        ? `${lead.city}/${lead.state}`
        : lead.city || lead.state || "";
    const coords =
      lead.latitude != null && lead.longitude != null
        ? `${lead.latitude}, ${lead.longitude}`
        : null;
    const images = lead.images || [];
    const sources = (lead.sources || [])
      .map((source) => source.provider)
      .filter(Boolean);
    const ig = lead.instagramConnections?.[0];
    const account = lead.users?.[0];

    kicker.textContent = isCustomer ? "Ficha do cliente" : "Ficha cadastral";
    title.textContent = lead.name || (isCustomer ? "Cliente" : "Lead");

    body.innerHTML = `
      <section class="lead-ficha-grid">
        <article class="lead-ficha-card">
          <h4>Contato</h4>
          <dl>
            ${item("Telefone", lead.phone)}
            ${item("WhatsApp", lead.whatsapp)}
            ${item("E-mail", lead.email)}
          </dl>
        </article>
        <article class="lead-ficha-card">
          <h4>Localização</h4>
          <dl>
            ${item("Cidade / UF", place)}
            ${item("Endereço", lead.address)}
            ${item("País", lead.country)}
            ${item("Coordenadas", coords)}
          </dl>
        </article>
        <article class="lead-ficha-card">
          <h4>Presença digital</h4>
          <dl>
            ${item("Website", lead.website)}
            ${item("Instagram", lead.instagram)}
            ${item("Facebook", lead.facebook)}
            ${item("LinkedIn", lead.linkedin)}
          </dl>
        </article>
        <article class="lead-ficha-card">
          <h4>Negócio</h4>
          <dl>
            ${item("Categoria", lead.category)}
            ${item("Serviços", lead.services)}
            ${item("Rating", lead.rating)}
            ${item("Reviews", lead.reviewCount)}
          </dl>
        </article>
      </section>
      ${
        lead.description
          ? `<section class="lead-ficha-card lead-ficha-card--wide">
              <h4>Descrição</h4>
              <p class="lead-ficha-copy">${escapeHtml(lead.description)}</p>
            </section>`
          : ""
      }
      <section class="lead-ficha-card lead-ficha-card--wide">
        <h4>Acesso</h4>
        <dl class="lead-ficha-access">
          ${item("ID", lead.id)}
          ${item("Fontes", sources.length ? sources.join(", ") : null)}
          ${item(
            "Instagram conectado",
            ig
              ? ig.username
                ? `@${ig.username.replace(/^@/, "")}`
                : ig.igUserId
              : null,
          )}
          ${item("Conta", account?.email || account?.name)}
          ${item("Atualizado", lead.updatedAt ? formatDate(lead.updatedAt) : null)}
        </dl>
        ${
          lead.id
            ? `<div class="lead-ficha-invite">
                <button type="button" class="secondary" data-ficha-invite>Gerar convite</button>
                <pre class="invite-output" data-ficha-invite-out hidden></pre>
              </div>`
            : ""
        }
      </section>
      <section class="lead-ficha-gallery">
        <div class="lead-ficha-gallery__head">
          <h4>Galeria</h4>
          <span>${images.length} foto${images.length === 1 ? "" : "s"}</span>
        </div>
        ${
          images.length
            ? `<ul class="lead-ficha-photos">${images
                .map((img) => {
                  const igPhoto = isInstagramImage(img);
                  const src = escapeHtml(imageSrc(img));
                  const alt = escapeHtml(img.filename || img.source || "Foto");
                  return `<li>
                    <figure class="lead-ficha-photo${igPhoto ? " is-instagram" : ""}">
                      <img src="${src}" alt="${alt}" loading="lazy" />
                      ${
                        igPhoto
                          ? `<span class="lead-ficha-photo__tag">Instagram</span>`
                          : ""
                      }
                      <div class="lead-ficha-photo__meta" role="tooltip">
                        ${photoMeta(img)}
                      </div>
                    </figure>
                  </li>`;
                })
                .join("")}</ul>`
            : `<p class="lead-ficha-empty">Nenhuma foto ainda.</p>`
        }
      </section>
    `;
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    lead = null;
  }

  function open(next: Lead) {
    lead = next;
    render();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function sync(next: Lead) {
    if (modal.hidden) return;
    lead = next;
    render();
  }

  async function createInvite() {
    const output = body.querySelector<HTMLElement>("[data-ficha-invite-out]");
    const button = body.querySelector<HTMLButtonElement>("[data-ficha-invite]");
    if (!lead?.id || !output || !button || busy) return;
    busy = true;
    button.disabled = true;
    output.hidden = false;
    output.textContent = "Gerando convite…";
    try {
      const res = await api("/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.whatsapp || lead.phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Falha ao gerar convite");
      }
      const text = data.whatsappPayload?.text || data.registerUrl;
      output.textContent = [
        data.registerUrl,
        "",
        text,
        "",
        data.evolution?.configured
          ? "Evolution configurada — POST /invites/:id/send-whatsapp quando for ligar o envio."
          : "Evolution ainda não configurada (envio WhatsApp preparado, não operacional).",
      ].join("\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore
      }
    } catch (error) {
      output.textContent =
        error instanceof Error ? error.message : "Erro ao gerar convite";
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-ficha-close]")) {
      close();
      return;
    }
    if (target?.closest("[data-ficha-invite]")) {
      void createInvite();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  return { open, close, sync };
}
