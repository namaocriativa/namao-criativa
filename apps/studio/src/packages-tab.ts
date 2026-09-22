import { api } from "./api";
import type { AgencyPackage, PackageImage } from "./types";
import { hrefFor, navigate, titleForRoute, type AppRoute } from "./router";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function imageSrc(img: PackageImage): string {
  const path = img.localPath.replace(/^\/+/, "");
  return `/${path}`;
}

function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
): string | null {
  if (value == null || Number.isNaN(value)) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(value);
  } catch {
    return `${currency || "BRL"} ${value}`;
  }
}

function formatPrice(pkg: AgencyPackage): string {
  const full = formatMoney(pkg.price, pkg.currency);
  const promo = formatMoney(pkg.promoPrice, pkg.currency);
  if (full && promo) return `de ${full} por ${promo}`;
  return full || "Sob consulta";
}

function statusLabel(status: string | undefined): string {
  return status === "active" ? "Ativo" : "Rascunho";
}

function benefitsToText(benefits: unknown): string {
  if (!Array.isArray(benefits)) return "";
  return benefits.map((item) => String(item)).join("\n");
}

function textToBenefits(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function formField<T extends HTMLElement>(
  form: HTMLFormElement,
  name: string,
): T {
  const node = form.elements.namedItem(name);
  if (!node || !(node instanceof HTMLElement)) {
    throw new Error(`Campo ${name} não encontrado`);
  }
  return node as T;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

export function initPackagesTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const listEl = requireEl<HTMLElement>("packages-list");
  const listStatus = requireEl<HTMLElement>("packages-status");
  const newBtn = requireEl<HTMLButtonElement>("packages-new-btn");
  const form = requireEl<HTMLFormElement>("package-form");
  const detailStatus = requireEl<HTMLElement>("package-detail-status");
  const detailHeading = requireEl<HTMLElement>("package-detail-heading");
  const detailMeta = requireEl<HTMLElement>("package-detail-meta");
  const deleteBtn = requireEl<HTMLButtonElement>("package-delete-btn");
  const saveBtn = requireEl<HTMLButtonElement>("package-save-btn");
  const mediaSection = requireEl<HTMLElement>("package-media-section");
  const mediaInput = requireEl<HTMLInputElement>("package-media-input");
  const mediaDrop = requireEl<HTMLElement>("package-media-drop");
  const mediaGrid = requireEl<HTMLElement>("package-media-grid");
  const mediaEmpty = requireEl<HTMLElement>("package-media-empty");
  const mediaStatus = requireEl<HTMLElement>("package-media-status");
  const offerForm = requireEl<HTMLFormElement>("package-offer-form");
  const offerStatus = requireEl<HTMLElement>("package-offer-status");
  const offerSaveBtn = requireEl<HTMLButtonElement>("package-offer-save-btn");

  let current: AgencyPackage | null = null;
  let busy = false;
  let mediaBusy = false;
  let offerBusy = false;

  function setListStatus(message: string, isError = false) {
    listStatus.textContent = message;
    listStatus.classList.toggle("error", isError);
  }

  function setDetailStatus(message: string, isError = false) {
    detailStatus.textContent = message;
    detailStatus.classList.toggle("error", isError);
  }

  function setMediaStatus(message: string, isError = false) {
    mediaStatus.textContent = message;
    mediaStatus.classList.toggle("error", isError);
  }

  function setOfferStatus(message: string, isError = false) {
    offerStatus.textContent = message;
    offerStatus.classList.toggle("error", isError);
  }

  function fillForm(pkg: AgencyPackage) {
    formField<HTMLInputElement>(form, "name").value = pkg.name || "";
    formField<HTMLSelectElement>(form, "status").value =
      pkg.status === "active" ? "active" : "draft";
    formField<HTMLInputElement>(form, "price").value =
      pkg.price != null ? String(pkg.price) : "";
    formField<HTMLInputElement>(form, "promoPrice").value =
      pkg.promoPrice != null ? String(pkg.promoPrice) : "";
    formField<HTMLInputElement>(form, "currency").value = pkg.currency || "BRL";
    formField<HTMLInputElement>(form, "summary").value = pkg.summary || "";
    formField<HTMLTextAreaElement>(form, "description").value =
      pkg.description || "";
    formField<HTMLTextAreaElement>(form, "benefits").value = benefitsToText(
      pkg.benefits,
    );
  }

  function readFormPayload() {
    const priceRaw = formField<HTMLInputElement>(form, "price").value.trim();
    const promoRaw = formField<HTMLInputElement>(form, "promoPrice").value.trim();
    const price =
      priceRaw === "" ? null : Number(priceRaw.replace(",", "."));
    const promoPrice =
      promoRaw === "" ? null : Number(promoRaw.replace(",", "."));
    return {
      name: formField<HTMLInputElement>(form, "name").value.trim(),
      status: formField<HTMLSelectElement>(form, "status").value,
      price: Number.isFinite(price as number) ? price : null,
      promoPrice: Number.isFinite(promoPrice as number) ? promoPrice : null,
      currency:
        formField<HTMLInputElement>(form, "currency").value.trim() || "BRL",
      summary:
        formField<HTMLInputElement>(form, "summary").value.trim() || null,
      description:
        formField<HTMLTextAreaElement>(form, "description").value.trim() ||
        null,
      benefits: textToBenefits(
        formField<HTMLTextAreaElement>(form, "benefits").value,
      ),
    };
  }

  function renderMedia(pkg: AgencyPackage) {
    const images = pkg.images || [];
    mediaEmpty.hidden = images.length > 0;
    mediaGrid.innerHTML = images
      .map((img) => {
        const src = escapeHtml(imageSrc(img));
        const title = escapeHtml(img.filename || "Imagem");
        const id = escapeHtml(img.id);
        return `<li>
          <figure>
            <img src="${src}" alt="${title}" loading="lazy" />
            <figcaption>${title}</figcaption>
          </figure>
          <button type="button" class="danger" data-delete-package-image="${id}">Excluir</button>
        </li>`;
      })
      .join("");
  }

  function renderDetail(pkg: AgencyPackage) {
    current = pkg;
    detailHeading.textContent = pkg.name || "Pacote";
    const count = pkg.images?.length ?? pkg._count?.images ?? 0;
    detailMeta.textContent = `${statusLabel(pkg.status)} · ${formatPrice(pkg)} · ${count} mídia(s)`;
    fillForm(pkg);
    mediaSection.hidden = false;
    renderMedia(pkg);
    document.title = titleForRoute({ name: "package", id: pkg.id }, pkg.name);
  }

  function renderList(items: AgencyPackage[]) {
    if (!items.length) {
      listEl.innerHTML =
        '<li class="empty-filter">Nenhum pacote ainda. Crie o primeiro com “Novo pacote”.</li>';
      return;
    }
    listEl.innerHTML = items
      .map((pkg) => {
        const id = encodeURIComponent(pkg.id);
        const name = escapeHtml(pkg.name);
        const summary = escapeHtml(pkg.summary || "Sem resumo");
        const status = escapeHtml(statusLabel(pkg.status));
        const price = escapeHtml(formatPrice(pkg));
        const count = pkg._count?.images ?? pkg.images?.length ?? 0;
        const thumb = pkg.images?.[0];
        const thumbHtml = thumb
          ? `<img class="package-thumb" src="${escapeHtml(imageSrc(thumb))}" alt="" loading="lazy" />`
          : `<span class="package-thumb package-thumb--empty" aria-hidden="true"></span>`;
        return `<li class="package-list-item">
          ${thumbHtml}
          <div class="package-list-body">
            <strong><a href="${hrefFor({ name: "package", id: pkg.id })}">${name}</a></strong>
            <span class="meta">${summary}</span>
            <span class="meta">${status} · ${price} · ${count} mídia(s)</span>
          </div>
          <div class="actions">
            <a class="button-link outline" href="${hrefFor({ name: "package", id: pkg.id })}">Editar</a>
            <button type="button" class="danger" data-delete-package="${id}">Excluir</button>
          </div>
        </li>`;
      })
      .join("");
  }

  async function loadList() {
    setListStatus("Carregando pacotes…");
    void loadOfferTemplate();
    try {
      const res = await api("/packages");
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao listar pacotes"));
      }
      const items = (await res.json()) as AgencyPackage[];
      renderList(items);
      setListStatus(
        items.length
          ? `${items.length} pacote(s)`
          : "Nenhum pacote cadastrado",
      );
    } catch (error) {
      renderList([]);
      setListStatus(errorMessage(error, "Falha ao listar pacotes"), true);
    }
  }

  async function loadDetail(id: string) {
    setDetailStatus("Carregando pacote…");
    mediaSection.hidden = true;
    try {
      const res = await api(`/packages/${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error(await readError(res, "Pacote não encontrado"));
      }
      const pkg = (await res.json()) as AgencyPackage;
      renderDetail(pkg);
      setDetailStatus("");
    } catch (error) {
      current = null;
      setDetailStatus(errorMessage(error, "Falha ao carregar pacote"), true);
    }
  }

  async function createPackage() {
    if (busy) return;
    busy = true;
    newBtn.disabled = true;
    setListStatus("Criando pacote…");
    try {
      const res = await api("/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Novo pacote",
          status: "draft",
          currency: "BRL",
          benefits: [],
        }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao criar pacote"));
      }
      const pkg = (await res.json()) as AgencyPackage;
      navigate({ name: "package", id: pkg.id });
    } catch (error) {
      setListStatus(errorMessage(error, "Falha ao criar pacote"), true);
    } finally {
      busy = false;
      newBtn.disabled = false;
    }
  }

  async function savePackage(event: Event) {
    event.preventDefault();
    if (!current?.id || busy) return;
    const payload = readFormPayload();
    if (!payload.name) {
      setDetailStatus("Informe o nome do pacote", true);
      return;
    }
    busy = true;
    saveBtn.disabled = true;
    setDetailStatus("Salvando…");
    try {
      const res = await api(`/packages/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao salvar pacote"));
      }
      const pkg = (await res.json()) as AgencyPackage;
      renderDetail(pkg);
      setDetailStatus("Pacote salvo");
    } catch (error) {
      setDetailStatus(errorMessage(error, "Falha ao salvar pacote"), true);
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  }

  async function deletePackage(id: string, fromDetail: boolean) {
    if (busy) return;
    if (!confirm("Excluir este pacote e suas mídias?")) return;
    busy = true;
    try {
      const res = await api(`/packages/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao excluir pacote"));
      }
      if (fromDetail) {
        navigate({ name: "packages" });
      } else {
        await loadList();
      }
    } catch (error) {
      const message = errorMessage(error, "Falha ao excluir pacote");
      if (fromDetail) setDetailStatus(message, true);
      else setListStatus(message, true);
    } finally {
      busy = false;
    }
  }

  async function uploadImages(files: FileList | File[]) {
    if (!current?.id || mediaBusy) return;
    const list = Array.from(files);
    if (!list.length) return;
    mediaBusy = true;
    setMediaStatus(`Enviando ${list.length} arquivo(s)…`);
    try {
      const body = new FormData();
      for (const file of list) body.append("files", file);
      const res = await api(
        `/packages/${encodeURIComponent(current.id)}/images`,
        { method: "POST", body },
      );
      if (!res.ok) {
        throw new Error(await readError(res, "Falha no upload"));
      }
      const pkg = (await res.json()) as AgencyPackage;
      renderDetail(pkg);
      setMediaStatus(`${list.length} imagem(ns) adicionada(s)`);
    } catch (error) {
      setMediaStatus(errorMessage(error, "Falha no upload"), true);
    } finally {
      mediaBusy = false;
      mediaInput.value = "";
    }
  }

  async function deleteImage(imageId: string) {
    if (!current?.id || mediaBusy) return;
    if (!confirm("Excluir esta imagem?")) return;
    mediaBusy = true;
    setMediaStatus("Excluindo imagem…");
    try {
      const res = await api(
        `/packages/${encodeURIComponent(current.id)}/images/${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao excluir imagem"));
      }
      const pkg = (await res.json()) as AgencyPackage;
      renderDetail(pkg);
      setMediaStatus("Imagem excluída");
    } catch (error) {
      setMediaStatus(errorMessage(error, "Falha ao excluir imagem"), true);
    } finally {
      mediaBusy = false;
    }
  }

  async function loadOfferTemplate() {
    setOfferStatus("Carregando template…");
    try {
      const res = await api("/packages/offer-template");
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao carregar template"));
      }
      const data = (await res.json()) as {
        emailSubject?: string;
        emailBody?: string;
        whatsappMessage?: string;
      };
      formField<HTMLInputElement>(offerForm, "emailSubject").value =
        data.emailSubject || "";
      formField<HTMLTextAreaElement>(offerForm, "emailBody").value =
        data.emailBody || "";
      formField<HTMLTextAreaElement>(offerForm, "whatsappMessage").value =
        data.whatsappMessage || "";
      setOfferStatus("");
    } catch (error) {
      setOfferStatus(errorMessage(error, "Falha ao carregar template"), true);
    }
  }

  async function saveOfferTemplate(event: Event) {
    event.preventDefault();
    if (offerBusy) return;
    offerBusy = true;
    offerSaveBtn.disabled = true;
    setOfferStatus("Salvando template…");
    try {
      const res = await api("/packages/offer-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject: formField<HTMLInputElement>(offerForm, "emailSubject")
            .value,
          emailBody: formField<HTMLTextAreaElement>(offerForm, "emailBody")
            .value,
          whatsappMessage: formField<HTMLTextAreaElement>(
            offerForm,
            "whatsappMessage",
          ).value,
        }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao salvar template"));
      }
      setOfferStatus("Template salvo");
    } catch (error) {
      setOfferStatus(errorMessage(error, "Falha ao salvar template"), true);
    } finally {
      offerBusy = false;
      offerSaveBtn.disabled = false;
    }
  }

  newBtn.addEventListener("click", () => void createPackage());
  offerForm.addEventListener("submit", (event) => void saveOfferTemplate(event));
  form.addEventListener("submit", (event) => void savePackage(event));
  deleteBtn.addEventListener("click", () => {
    if (current?.id) void deletePackage(current.id, true);
  });

  listEl.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest(
      "[data-delete-package]",
    ) as HTMLElement | null;
    if (!target?.dataset.deletePackage) return;
    event.preventDefault();
    void deletePackage(decodeURIComponent(target.dataset.deletePackage), false);
  });

  mediaGrid.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest(
      "[data-delete-package-image]",
    ) as HTMLElement | null;
    if (!target?.dataset.deletePackageImage) return;
    void deleteImage(target.dataset.deletePackageImage);
  });

  mediaInput.addEventListener("change", () => {
    if (mediaInput.files?.length) void uploadImages(mediaInput.files);
  });

  mediaDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    mediaDrop.classList.add("is-dragover");
  });
  mediaDrop.addEventListener("dragleave", () => {
    mediaDrop.classList.remove("is-dragover");
  });
  mediaDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    mediaDrop.classList.remove("is-dragover");
    const files = event.dataTransfer?.files;
    if (files?.length) void uploadImages(files);
  });

  function onRoute(route: AppRoute) {
    if (route.name === "packages") {
      void loadList();
      return;
    }
    if (route.name === "package") {
      void loadDetail(route.id);
    }
  }

  return { onRoute };
}
