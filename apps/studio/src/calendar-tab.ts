import { api } from "./api";
import { canAccessImages, canAccessVideos } from "./session";
import type {
  CalendarAsset,
  CalendarAutomation,
  CalendarPlatform,
  CalendarPost,
  ImageLibraryProject,
  Lead,
  VideoLibraryProject,
} from "./types";
import { hrefFor, navigate, titleForRoute, type AppRoute } from "./router";

const PLATFORMS: { id: CalendarPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

const COMPOSE_URL: Record<CalendarPlatform, string> = {
  instagram: "https://www.instagram.com/",
  youtube: "https://studio.youtube.com/channel/upload",
  tiktok: "https://www.tiktok.com/tiktokstudio/upload",
};

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function postDayKey(post: CalendarPost): string {
  return dayKey(new Date(post.scheduledAt));
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "scheduled":
      return "Agendado";
    case "publishing":
      return "Publicando";
    case "published":
      return "Publicado";
    case "partial":
      return "Parcial";
    case "failed":
      return "Falhou";
    case "ready_manual":
      return "Publicar no app";
    case "needs_connection":
      return "Falta conexão";
    case "pending":
      return "Na fila";
    default:
      return status;
  }
}

function platformLabel(platform: string): string {
  return PLATFORMS.find((item) => item.id === platform)?.label || platform;
}

function assetSrc(asset: CalendarAsset): string {
  return `/${asset.localPath.replace(/^\/+/, "")}`;
}

function defaultWhen(day?: Date): string {
  const date = day ? new Date(day) : new Date();
  if (!day) date.setHours(date.getHours() + 1, 0, 0, 0);
  else date.setHours(10, 0, 0, 0);
  return toLocalInput(date.toISOString());
}

export function initCalendarTab() {
  const grid = requireEl<HTMLDivElement>("cal-grid");
  const side = requireEl<HTMLElement>("cal-side");
  const status = requireEl<HTMLElement>("cal-status");
  const monthLabel = requireEl<HTMLElement>("cal-month-label");
  const automation = requireEl<HTMLElement>("cal-automation");
  const newBtn = requireEl<HTMLButtonElement>("cal-new-btn");
  const prevBtn = requireEl<HTMLButtonElement>("cal-prev-btn");
  const nextBtn = requireEl<HTMLButtonElement>("cal-next-btn");

  let month = startOfMonth(new Date());
  let posts: CalendarPost[] = [];
  let selectedDay = dayKey(new Date());
  let editingId: string | null = null;
  let creating = false;
  let caps: CalendarAutomation | null = null;

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  async function loadMonth() {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const res = await api(
      `/calendar/posts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    );
    if (!res.ok) throw new Error(await readError(res, "Não carregou o calendário"));
    posts = (await res.json()) as CalendarPost[];
  }

  async function loadCaps() {
    const res = await api("/calendar/automation");
    if (!res.ok) return;
    caps = (await res.json()) as CalendarAutomation;
    const ig = caps.instagram.autoPublish
      ? "Instagram publica sozinho se o cliente autorizou o Graph."
      : caps.instagram.needsPublicApi
        ? "Instagram automático precisa da API pública (PUBLIC_CHAT_API_ORIGIN)."
        : "Configure o App Meta para publicação automática no Instagram.";
    automation.textContent = `${ig} YouTube e TikTok: na hora, copie a legenda e abra o app.`;
  }

  function renderGrid() {
    monthLabel.textContent = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
    const first = startOfMonth(month);
    const startOffset = mondayIndex(first);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: string[] = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(`<div class="cal-cell is-empty"></div>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const key = dayKey(date);
      const dayPosts = posts.filter((post) => postDayKey(post) === key);
      const chips = dayPosts
        .slice(0, 3)
        .map((post) => {
          const platforms = (post.targets || [])
            .map((target) => `<i class="cal-dot cal-dot--${escapeHtml(target.platform)}"></i>`)
            .join("");
          return `<span class="cal-chip cal-chip--${escapeHtml(post.status)}">${platforms}${escapeHtml(post.title)}</span>`;
        })
        .join("");
      const extra =
        dayPosts.length > 3
          ? `<span class="cal-more">+${dayPosts.length - 3}</span>`
          : "";
      cells.push(`
        <button type="button" class="cal-cell${key === selectedDay ? " is-selected" : ""}" data-day="${key}">
          <span class="cal-daynum">${day}</span>
          <span class="cal-chips">${chips}${extra}</span>
        </button>
      `);
    }
    grid.innerHTML = cells.join("");
  }

  function renderSide() {
    if (creating || editingId) {
      void renderEditor();
      return;
    }
    const dayPosts = posts
      .filter((post) => postDayKey(post) === selectedDay)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    const date = new Date(`${selectedDay}T00:00:00`);
    const heading = Number.isNaN(date.getTime())
      ? selectedDay
      : date.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
    side.innerHTML = `
      <div class="cal-side-head">
        <h3>${escapeHtml(heading)}</h3>
        <button type="button" data-cal-new-day>Novo neste dia</button>
      </div>
      ${
        dayPosts.length
          ? `<ul class="cal-day-list">${dayPosts
              .map((post) => {
                const time = new Date(post.scheduledAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const platforms = (post.targets || [])
                  .map(
                    (target) =>
                      `<span class="cal-plat cal-plat--${escapeHtml(target.platform)}">${escapeHtml(platformLabel(target.platform))}</span>`,
                  )
                  .join("");
                return `<li>
                  <a href="${hrefFor({ name: "calendar-post", id: post.id })}" data-open-post="${post.id}">
                    <strong>${escapeHtml(post.title)}</strong>
                    <span>${escapeHtml(time)} · ${escapeHtml(statusLabel(post.status))}</span>
                    <span class="cal-plats">${platforms}</span>
                  </a>
                </li>`;
              })
              .join("")}</ul>`
          : `<p class="prompt-hint">Nenhum post neste dia.</p>`
      }
    `;
  }

  async function renderEditor() {
    const post = editingId ? posts.find((item) => item.id === editingId) || (await fetchPost(editingId)) : null;
    const imageLib = canAccessImages() ? await fetchImageLibrary() : [];
    const videoLib = canAccessVideos() ? await fetchVideoLibrary() : [];
    const owners = await fetchOwners();
    const scheduled = post ? toLocalInput(post.scheduledAt) : defaultWhen(new Date(`${selectedDay}T00:00:00`));
    const selectedPlatforms = new Set(
      (post?.targets || []).map((target) => target.platform),
    );
    if (!selectedPlatforms.size) selectedPlatforms.add("instagram");
    const ownerValue = post?.leadId
      ? `lead:${post.leadId}`
      : post?.customerId
        ? `customer:${post.customerId}`
        : "";
    side.innerHTML = `
      <form class="cal-editor" id="cal-editor">
        <div class="cal-side-head">
          <h3>${post ? "Editar post" : "Novo post"}</h3>
          <a href="/calendario" data-cal-cancel>Fechar</a>
        </div>
        <label>Título
          <input name="title" required maxlength="200" value="${escapeHtml(post?.title || "")}" placeholder="Ex.: Reel da cobertura" />
        </label>
        <label>Quando
          <input name="scheduledAt" type="datetime-local" required value="${escapeHtml(scheduled)}" />
        </label>
        <fieldset class="cal-platforms">
          <legend>Plataformas</legend>
          ${PLATFORMS.map(
            (platform) => `
            <label class="cal-check">
              <input type="checkbox" name="platform" value="${platform.id}" ${selectedPlatforms.has(platform.id) ? "checked" : ""} />
              ${platform.label}
            </label>`,
          ).join("")}
        </fieldset>
        <label>Perfil (opcional)
          <select name="owner">
            <option value="">Agência / sem perfil</option>
            ${owners
              .map(
                (owner) =>
                  `<option value="${escapeHtml(owner.value)}" ${owner.value === ownerValue ? "selected" : ""}>${escapeHtml(owner.label)}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label>Legenda
          <textarea name="caption" rows="5" maxlength="2200" placeholder="Texto do post">${escapeHtml(post?.caption || "")}</textarea>
        </label>
        ${post ? renderAssets(post) : `<p class="prompt-hint">Salve o post para anexar mídia.</p>`}
        ${post ? renderStudioPickers(imageLib, videoLib) : ""}
        ${post ? renderTargets(post) : ""}
        <div class="actions cal-editor-actions">
          <button type="submit">${post ? "Salvar" : "Criar"}</button>
          ${
            post
              ? `<button type="button" data-cal-schedule>Agendar</button>
                 <button type="button" data-cal-publish>Publicar agora</button>
                 <button type="button" class="danger" data-cal-delete>Excluir</button>`
              : ""
          }
        </div>
      </form>
    `;
  }

  function renderAssets(post: CalendarPost): string {
    const assets = post.assets || [];
    return `
      <div class="cal-assets">
        <strong>Mídia</strong>
        <div class="cal-asset-grid">
          ${assets
            .map((asset) =>
              asset.kind === "video"
                ? `<figure><video src="${escapeHtml(assetSrc(asset))}" controls></video>
                    <button type="button" data-del-asset="${asset.id}">Remover</button></figure>`
                : `<figure><img src="${escapeHtml(assetSrc(asset))}" alt="" />
                    <button type="button" data-del-asset="${asset.id}">Remover</button></figure>`,
            )
            .join("")}
          <label class="cal-upload">
            Enviar arquivo
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple data-cal-files />
          </label>
        </div>
      </div>
    `;
  }

  function renderStudioPickers(
    images: ImageLibraryProject[],
    videos: VideoLibraryProject[],
  ): string {
    const imageOptions = images.flatMap((project) =>
      project.assets.map(
        (asset) =>
          `<option value="${escapeHtml(asset.id)}">${escapeHtml(project.name)} · ${escapeHtml(asset.filename)}</option>`,
      ),
    );
    const videoOptions = videos.flatMap((project) =>
      project.assets.map(
        (asset) =>
          `<option value="${escapeHtml(asset.id)}">${escapeHtml(project.name)} · ${escapeHtml(asset.filename)}</option>`,
      ),
    );
    if (!imageOptions.length && !videoOptions.length) return "";
    return `
      <div class="cal-studio-pick">
        ${
          imageOptions.length
            ? `<label>Do studio de imagens
                <select data-studio-image>
                  <option value="">Escolher imagem gerada</option>
                  ${imageOptions.join("")}
                </select>
              </label>`
            : ""
        }
        ${
          videoOptions.length
            ? `<label>Do studio de vídeos
                <select data-studio-video>
                  <option value="">Escolher vídeo gerado</option>
                  ${videoOptions.join("")}
                </select>
              </label>`
            : ""
        }
      </div>
    `;
  }

  function renderTargets(post: CalendarPost): string {
    const targets = post.targets || [];
    if (!targets.length) return "";
    return `
      <ul class="cal-targets">
        ${targets
          .map((target) => {
            const platform = target.platform as CalendarPlatform;
            const compose = COMPOSE_URL[platform];
            const manual =
              target.status === "ready_manual" ||
              target.status === "needs_connection" ||
              target.status === "failed";
            return `<li class="cal-target cal-target--${escapeHtml(target.status)}">
              <strong>${escapeHtml(platformLabel(target.platform))}</strong>
              <span>${escapeHtml(statusLabel(target.status))}</span>
              ${target.error ? `<p>${escapeHtml(target.error)}</p>` : ""}
              ${
                target.permalink
                  ? `<a href="${escapeHtml(target.permalink)}" target="_blank" rel="noreferrer">Ver post</a>`
                  : ""
              }
              ${
                compose && target.status !== "published"
                  ? `<a href="${compose}" target="_blank" rel="noreferrer">Abrir ${escapeHtml(platformLabel(target.platform))}</a>`
                  : ""
              }
              ${
                manual && target.status !== "published"
                  ? `<button type="button" data-mark-published="${target.id}">Marcar como publicado</button>
                     <button type="button" data-copy-caption>Copiar legenda</button>`
                  : ""
              }
            </li>`;
          })
          .join("")}
      </ul>
    `;
  }

  async function fetchPost(id: string): Promise<CalendarPost> {
    const res = await api(`/calendar/posts/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Post não encontrado"));
    const post = (await res.json()) as CalendarPost;
    const index = posts.findIndex((item) => item.id === post.id);
    if (index >= 0) posts[index] = post;
    else posts.push(post);
    return post;
  }

  async function fetchOwners(): Promise<{ value: string; label: string }[]> {
    const [leadsRes, customersRes] = await Promise.all([
      api("/leads"),
      api("/customers"),
    ]);
    const leads = leadsRes.ok ? ((await leadsRes.json()) as Lead[]) : [];
    const customers = customersRes.ok ? ((await customersRes.json()) as Lead[]) : [];
    return [
      ...customers.map((item) => ({
        value: `customer:${item.id}`,
        label: `Cliente · ${item.name}`,
      })),
      ...leads.map((item) => ({
        value: `lead:${item.id}`,
        label: `Lead · ${item.name}`,
      })),
    ];
  }

  async function fetchImageLibrary(): Promise<ImageLibraryProject[]> {
    try {
      const res = await api("/image-projects/library");
      if (!res.ok) return [];
      return (await res.json()) as ImageLibraryProject[];
    } catch {
      return [];
    }
  }

  async function fetchVideoLibrary(): Promise<VideoLibraryProject[]> {
    try {
      const res = await api("/video-projects/library");
      if (!res.ok) return [];
      return (await res.json()) as VideoLibraryProject[];
    } catch {
      return [];
    }
  }

  function readEditor(): {
    title: string;
    caption: string;
    scheduledAt: string;
    platforms: CalendarPlatform[];
    leadId: string | null;
    customerId: string | null;
  } {
    const form = requireEl<HTMLFormElement>("cal-editor");
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const caption = String(data.get("caption") || "").trim();
    const local = String(data.get("scheduledAt") || "");
    const scheduledAt = local ? new Date(local).toISOString() : "";
    const platforms = [...form.querySelectorAll<HTMLInputElement>('input[name="platform"]:checked')].map(
      (input) => input.value as CalendarPlatform,
    );
    const owner = String(data.get("owner") || "");
    let leadId: string | null = null;
    let customerId: string | null = null;
    if (owner.startsWith("lead:")) leadId = owner.slice(5);
    if (owner.startsWith("customer:")) customerId = owner.slice(9);
    return { title, caption, scheduledAt, platforms, leadId, customerId };
  }

  async function saveEditor(event: SubmitEvent) {
    event.preventDefault();
    const body = readEditor();
    if (!body.title || !body.scheduledAt || !body.platforms.length) {
      setStatus("Título, data e uma plataforma são obrigatórios.", true);
      return;
    }
    setStatus(editingId ? "Salvando…" : "Criando…");
    const res = editingId
      ? await api(`/calendar/posts/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await api("/calendar/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!res.ok) {
      setStatus(await readError(res, "Não salvou o post"), true);
      return;
    }
    const post = (await res.json()) as CalendarPost;
    creating = false;
    editingId = post.id;
    navigate({ name: "calendar-post", id: post.id });
    setStatus("Post salvo.");
    await refresh();
  }

  async function refresh() {
    await loadMonth();
    if (editingId) {
      try {
        await fetchPost(editingId);
      } catch {
        editingId = null;
        creating = false;
      }
    }
    renderGrid();
    renderSide();
  }

  grid.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest("[data-day]") as HTMLElement | null;
    if (!target?.dataset.day) return;
    selectedDay = target.dataset.day;
    creating = false;
    editingId = null;
    navigate({ name: "calendar" });
    renderGrid();
    renderSide();
  });

  side.addEventListener("click", (event) => {
    const node = event.target as HTMLElement | null;
    if (node?.closest("[data-cal-new-day]")) {
      event.preventDefault();
      creating = true;
      editingId = null;
      void renderEditor();
      return;
    }
    const open = node?.closest("[data-open-post]") as HTMLElement | null;
    if (open?.dataset.openPost) {
      event.preventDefault();
      creating = false;
      editingId = open.dataset.openPost;
      navigate({ name: "calendar-post", id: editingId });
      void renderEditor();
      return;
    }
    if (node?.closest("[data-cal-cancel]")) {
      event.preventDefault();
      creating = false;
      editingId = null;
      navigate({ name: "calendar" });
      renderSide();
      return;
    }
  });

  side.addEventListener("submit", (event) => {
    if ((event.target as HTMLElement).id !== "cal-editor") return;
    void saveEditor(event as SubmitEvent);
  });

  side.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!input || !editingId) return;
    if (input instanceof HTMLInputElement && input.matches("[data-cal-files]") && input.files?.length) {
      void uploadFiles(editingId, input.files);
      return;
    }
    if (input instanceof HTMLSelectElement && input.matches("[data-studio-image]") && input.value) {
      void attachStudio(editingId, "image-studio", input.value);
      input.value = "";
      return;
    }
    if (input instanceof HTMLSelectElement && input.matches("[data-studio-video]") && input.value) {
      void attachStudio(editingId, "video-studio", input.value);
      input.value = "";
    }
  });

  side.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("button") as HTMLButtonElement | null;
    if (!btn || !editingId) return;
    if (btn.dataset.calSchedule !== undefined) {
      void act(`/calendar/posts/${encodeURIComponent(editingId)}/schedule`, "Agendado.");
      return;
    }
    if (btn.dataset.calPublish !== undefined) {
      void act(`/calendar/posts/${encodeURIComponent(editingId)}/publish`, "Publicação disparada.");
      return;
    }
    if (btn.dataset.calDelete !== undefined) {
      if (!window.confirm("Excluir este post?")) return;
      void (async () => {
        const res = await api(`/calendar/posts/${encodeURIComponent(editingId!)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setStatus(await readError(res, "Não excluiu"), true);
          return;
        }
        editingId = null;
        creating = false;
        navigate({ name: "calendar" });
        setStatus("Post excluído.");
        await refresh();
      })();
      return;
    }
    if (btn.dataset.delAsset) {
      void (async () => {
        const res = await api(
          `/calendar/posts/${encodeURIComponent(editingId!)}/assets/${encodeURIComponent(btn.dataset.delAsset!)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          setStatus(await readError(res, "Não removeu a mídia"), true);
          return;
        }
        await refresh();
      })();
      return;
    }
    if (btn.dataset.markPublished) {
      void act(
        `/calendar/posts/${encodeURIComponent(editingId)}/targets/${encodeURIComponent(btn.dataset.markPublished)}/mark-published`,
        "Marcado como publicado.",
      );
      return;
    }
    if (btn.dataset.copyCaption !== undefined) {
      const post = posts.find((item) => item.id === editingId);
      const text = post?.caption || post?.title || "";
      void navigator.clipboard.writeText(text).then(
        () => setStatus("Legenda copiada."),
        () => setStatus("Não copiou a legenda.", true),
      );
    }
  });

  async function uploadFiles(postId: string, files: FileList) {
    const data = new FormData();
    for (const file of files) data.append("files", file);
    setStatus("Enviando mídia…");
    const res = await api(`/calendar/posts/${encodeURIComponent(postId)}/assets`, {
      method: "POST",
      body: data,
    });
    if (!res.ok) {
      setStatus(await readError(res, "Não enviou a mídia"), true);
      return;
    }
    await refresh();
    setStatus("Mídia anexada.");
  }

  async function attachStudio(
    postId: string,
    source: "image-studio" | "video-studio",
    assetId: string,
  ) {
    setStatus("Anexando do studio…");
    const res = await api(
      `/calendar/posts/${encodeURIComponent(postId)}/assets/from-studio`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, assetId }),
      },
    );
    if (!res.ok) {
      setStatus(await readError(res, "Não anexou a mídia"), true);
      return;
    }
    await refresh();
    setStatus("Mídia do studio anexada.");
  }

  async function act(path: string, okMessage: string) {
    setStatus("Enviando…");
    const res = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) {
      setStatus(await readError(res, "Não concluiu a ação"), true);
      return;
    }
    await refresh();
    setStatus(okMessage);
  }

  newBtn.addEventListener("click", () => {
    creating = true;
    editingId = null;
    selectedDay = dayKey(new Date());
    void renderEditor();
  });
  prevBtn.addEventListener("click", () => {
    month = addMonths(month, -1);
    void refresh();
  });
  nextBtn.addEventListener("click", () => {
    month = addMonths(month, 1);
    void refresh();
  });

  async function onRoute(route: AppRoute) {
    if (route.name !== "calendar" && route.name !== "calendar-post") return;
    try {
      await loadCaps();
      if (route.name === "calendar-post") {
        editingId = route.id;
        creating = false;
        const post = await fetchPost(route.id);
        month = startOfMonth(new Date(post.scheduledAt));
        selectedDay = postDayKey(post);
        document.title = titleForRoute(route, post.title);
      } else if (!creating) {
        editingId = null;
      }
      await loadMonth();
      renderGrid();
      renderSide();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Não abriu o calendário"), true);
    }
  }

  return { onRoute };
}
