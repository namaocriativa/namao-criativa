import { api } from "./api";
import { canAccessImages, canAccessVideos } from "./session";
import type {
  CalendarAsset,
  CalendarAutomation,
  CalendarIdea,
  CalendarIdeasSpec,
  CalendarItems,
  CalendarPlatform,
  CalendarPost,
  CalendarReminder,
  ImageLibraryProject,
  Lead,
  VideoLibraryProject,
} from "./types";

type CreatingMode = "pick" | "manual" | "carousel" | "ideas";
import { hrefFor, navigate, titleForRoute, type AppRoute } from "./router";
import { saveRepurposeDraft } from "./repurpose-draft";

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

function reminderDayKey(reminder: CalendarReminder): string {
  return dayKey(new Date(reminder.scheduledAt));
}

function reminderStatusLabel(status: string): string {
  return status === "done" ? "Feito" : "Aberto";
}

type ProfileLock = { kind: "lead" | "customer"; id: string };

function profileLockOf(route: AppRoute): ProfileLock | null {
  if (
    route.name === "lead-calendar" ||
    route.name === "lead-calendar-post"
  ) {
    return { kind: "lead", id: route.id };
  }
  if (
    route.name === "customer-calendar" ||
    route.name === "customer-calendar-post"
  ) {
    return { kind: "customer", id: route.id };
  }
  return null;
}

function isCalendarRoute(route: AppRoute): boolean {
  return (
    route.name === "calendar" ||
    route.name === "calendar-post" ||
    route.name === "lead-calendar" ||
    route.name === "lead-calendar-post" ||
    route.name === "customer-calendar" ||
    route.name === "customer-calendar-post"
  );
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
  const reminderBtn = requireEl<HTMLButtonElement>("cal-new-reminder-btn");
  const prevBtn = requireEl<HTMLButtonElement>("cal-prev-btn");
  const nextBtn = requireEl<HTMLButtonElement>("cal-next-btn");
  const titleEl = requireEl<HTMLElement>("cal-title");
  const hintEl = requireEl<HTMLElement>("cal-hint");
  const backEl = requireEl<HTMLElement>("cal-back");
  const backLink = requireEl<HTMLAnchorElement>("cal-back-link");

  let month = startOfMonth(new Date());
  let posts: CalendarPost[] = [];
  let reminders: CalendarReminder[] = [];
  let selectedDay = dayKey(new Date());
  let editingId: string | null = null;
  let editingReminderId: string | null = null;
  let creating = false;
  let creatingKind: "post" | "reminder" = "post";
  let creatingMode: CreatingMode = "pick";
  let profileLock: ProfileLock | null = null;
  let caps: CalendarAutomation | null = null;
  let ideasPack: CalendarIdeasSpec | null = null;
  let ideasNotes = "";
  let ideasBusy = false;
  let ideasOwner = "";
  let ideasWhen = "";
  let pendingIdea: CalendarIdea | null = null;
  let carouselBusy = false;
  let carouselUrl = "";
  let carouselNotes = "";
  let carouselOwner = "";
  let carouselWhen = "";
  let carouselSlideCount = 5;
  let lastPrefillUrl = "";

  function homeRoute(): AppRoute {
    if (profileLock?.kind === "lead") {
      return { name: "lead-calendar", id: profileLock.id };
    }
    if (profileLock?.kind === "customer") {
      return { name: "customer-calendar", id: profileLock.id };
    }
    return { name: "calendar" };
  }

  function postRoute(postId: string): AppRoute {
    if (profileLock?.kind === "lead") {
      return { name: "lead-calendar-post", id: profileLock.id, postId };
    }
    if (profileLock?.kind === "customer") {
      return { name: "customer-calendar-post", id: profileLock.id, postId };
    }
    return { name: "calendar-post", id: postId };
  }

  function ownerQuery(): string {
    if (!profileLock) return "";
    const key = profileLock.kind === "lead" ? "leadId" : "customerId";
    return `&${key}=${encodeURIComponent(profileLock.id)}`;
  }

  function applyChrome() {
    reminderBtn.hidden = !profileLock;
    newBtn.textContent = profileLock ? "Novo post Instagram" : "Novo post";
    if (profileLock) {
      titleEl.textContent = "Agenda";
      hintEl.textContent =
        "Posts do Instagram e lembretes só deste perfil. A aba Calendário continua com a visão da agência.";
      backEl.hidden = false;
      backLink.href = hrefFor({
        name: profileLock.kind === "customer" ? "customer" : "lead",
        id: profileLock.id,
      });
    } else {
      titleEl.textContent = "Calendário";
      hintEl.textContent =
        "Planeje posts para Instagram, YouTube e TikTok. O Instagram publica sozinho se o cliente autorizou o Graph; as outras redes abrem o app na hora.";
      backEl.hidden = true;
    }
  }

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  async function loadMonth() {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const res = await api(
      `/calendar/items?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${ownerQuery()}`,
    );
    if (!res.ok) throw new Error(await readError(res, "Não carregou o calendário"));
    const data = (await res.json()) as CalendarItems;
    posts = data.posts || [];
    reminders = data.reminders || [];
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
      const dayReminders = reminders.filter((item) => reminderDayKey(item) === key);
      const chips = [
        ...dayPosts.map((post) => {
          const platforms = (post.targets || [])
            .map((target) => `<i class="cal-dot cal-dot--${escapeHtml(target.platform)}"></i>`)
            .join("");
          return `<span class="cal-chip cal-chip--${escapeHtml(post.status)}">${platforms}${escapeHtml(post.title)}</span>`;
        }),
        ...dayReminders.map(
          (item) =>
            `<span class="cal-chip cal-chip--reminder cal-chip--${escapeHtml(item.status)}">${escapeHtml(item.title)}</span>`,
        ),
      ];
      const extra =
        chips.length > 3
          ? `<span class="cal-more">+${chips.length - 3}</span>`
          : "";
      const shown = chips.slice(0, 3).join("");
      cells.push(`
        <button type="button" class="cal-cell${key === selectedDay ? " is-selected" : ""}" data-day="${key}">
          <span class="cal-daynum">${day}</span>
          <span class="cal-chips">${shown}${extra}</span>
        </button>
      `);
    }
    grid.innerHTML = cells.join("");
  }

  function renderCompose() {
    if (creatingKind === "reminder" || editingReminderId) {
      void renderReminderEditor();
      return;
    }
    if (creating && !editingId) {
      if (creatingMode === "pick") {
        renderPicker();
        return;
      }
      if (creatingMode === "carousel") {
        void renderCarouselSkill();
        return;
      }
      if (creatingMode === "ideas") {
        void renderIdeasSkill();
        return;
      }
    }
    void renderEditor();
  }

  function renderSide() {
    if (creating || editingId || editingReminderId) {
      renderCompose();
      return;
    }
    const dayPosts = posts
      .filter((post) => postDayKey(post) === selectedDay)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    const dayReminders = reminders
      .filter((item) => reminderDayKey(item) === selectedDay)
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
        <button type="button" data-cal-new-day>Novo post neste dia</button>
        ${
          profileLock
            ? `<button type="button" class="secondary" data-cal-new-reminder-day>Novo lembrete</button>`
            : ""
        }
      </div>
      ${
        dayPosts.length || dayReminders.length
          ? `<ul class="cal-day-list">${[
              ...dayPosts.map((post) => {
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
                  <a href="${hrefFor(postRoute(post.id))}" data-open-post="${post.id}">
                    <strong>${escapeHtml(post.title)}</strong>
                    <span>${escapeHtml(time)} · ${escapeHtml(statusLabel(post.status))}</span>
                    <span class="cal-plats">${platforms}</span>
                  </a>
                </li>`;
              }),
              ...dayReminders.map((item) => {
                const time = new Date(item.scheduledAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return `<li>
                  <button type="button" data-open-reminder="${item.id}">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(time)} · Lembrete · ${escapeHtml(reminderStatusLabel(item.status))}</span>
                  </button>
                </li>`;
              }),
            ].join("")}</ul>`
          : `<p class="prompt-hint">${profileLock ? "Nada neste dia." : "Nenhum post neste dia."}</p>`
      }
    `;
  }

  function renderPicker() {
    const title = profileLock ? "Novo post Instagram" : "Novo post";
    side.innerHTML = `
      <div class="cal-side-head">
        <h3>${escapeHtml(title)}</h3>
        <a href="${hrefFor(homeRoute())}" data-cal-cancel>Fechar</a>
      </div>
      <ul class="cal-create-list">
        <li>
          <button type="button" data-cal-mode="manual">
            <span class="cal-create-kicker">Manual</span>
            <strong>Post agendado</strong>
            <span>Título, data, legenda e mídia. Você agenda.</span>
          </button>
        </li>
        <li>
          <button type="button" data-cal-mode="carousel">
            <span class="cal-create-kicker">Skill</span>
            <strong>Carrossel do lead</strong>
            <span>Cole o Instagram ou o site. A skill gera os slides 4:5.</span>
          </button>
        </li>
        <li>
          <button type="button" data-cal-mode="ideas">
            <span class="cal-create-kicker">Skill</span>
            <strong>Ideias da semana</strong>
            <span>Dores, hooks e 5 rascunhos nos próximos dias.</span>
          </button>
        </li>
      </ul>
    `;
  }

  function renderOwnerFields(
    ownerValue: string,
    owners: { value: string; label: string }[],
    required: boolean,
  ): string {
    if (profileLock) {
      return `<input type="hidden" name="platform" value="instagram" />
        <input type="hidden" name="owner" value="${escapeHtml(ownerValue)}" />
        <p class="prompt-hint">Instagram · perfil desta agenda.</p>`;
    }
    return `<input type="hidden" name="platform" value="instagram" />
      <label>Perfil${required ? "" : " (opcional)"}
        <select name="owner" ${required ? "required" : ""}>
          <option value="">${required ? "Escolha o lead ou cliente" : "Agência / sem perfil"}</option>
          ${owners
            .map(
              (owner) =>
                `<option value="${escapeHtml(owner.value)}" ${owner.value === ownerValue ? "selected" : ""}>${escapeHtml(owner.label)}</option>`,
            )
            .join("")}
        </select>
      </label>`;
  }

  async function renderEditor() {
    rememberIdeasNotes();
    const post = editingId ? posts.find((item) => item.id === editingId) || (await fetchPost(editingId)) : null;
    const imageLib = canAccessImages() ? await fetchImageLibrary() : [];
    const videoLib = canAccessVideos() ? await fetchVideoLibrary() : [];
    const owners = await fetchOwners();
    const scheduled = post ? toLocalInput(post.scheduledAt) : defaultWhen(new Date(`${selectedDay}T00:00:00`));
    const selectedPlatforms = new Set(
      (post?.targets || []).map((target) => target.platform),
    );
    if (!selectedPlatforms.size) selectedPlatforms.add("instagram");
    const lockedOwner = profileLock
      ? `${profileLock.kind}:${profileLock.id}`
      : "";
    const ownerValue = post?.leadId
      ? `lead:${post.leadId}`
      : post?.customerId
        ? `customer:${post.customerId}`
        : lockedOwner;
    const platforms = profileLock
      ? PLATFORMS.filter((platform) => platform.id === "instagram")
      : PLATFORMS;
    const draftTitle = post?.title || pendingIdea?.title || "";
    const draftCaption = post?.caption || pendingIdea?.caption || "";
    if (!post && pendingIdea) pendingIdea = null;
    side.innerHTML = `
      <form class="cal-editor" id="cal-editor">
        <div class="cal-side-head">
          <h3>${post ? "Editar post" : profileLock ? "Novo post Instagram" : "Novo post"}</h3>
          ${
            post
              ? `<a href="${hrefFor(homeRoute())}" data-cal-cancel>Fechar</a>`
              : `<button type="button" data-cal-back-pick>Voltar</button>`
          }
        </div>
        <label>Título
          <input name="title" required maxlength="200" value="${escapeHtml(draftTitle)}" placeholder="Ex.: Reel da cobertura" />
        </label>
        <label>Quando
          <input name="scheduledAt" type="datetime-local" required value="${escapeHtml(scheduled)}" />
        </label>
        ${
          profileLock
            ? `<input type="hidden" name="platform" value="instagram" />
               <input type="hidden" name="owner" value="${escapeHtml(ownerValue)}" />
               <p class="prompt-hint">Instagram · perfil desta agenda.</p>`
            : `<fieldset class="cal-platforms">
          <legend>Plataformas</legend>
          ${platforms
            .map(
              (platform) => `
            <label class="cal-check">
              <input type="checkbox" name="platform" value="${platform.id}" ${selectedPlatforms.has(platform.id) ? "checked" : ""} />
              ${platform.label}
            </label>`,
            )
            .join("")}
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
        </label>`
        }
        <label>Legenda
          <textarea name="caption" rows="5" maxlength="2200" placeholder="Texto do post">${escapeHtml(draftCaption)}</textarea>
        </label>
        ${post ? renderAssets(post) : `<p class="prompt-hint">Salve o post para anexar mídia.</p>`}
        ${post ? renderStudioPickers(imageLib, videoLib) : ""}
        ${post ? renderTargets(post) : ""}
        <div class="actions cal-editor-actions">
          <button type="submit">${post ? "Salvar" : "Criar"}</button>
          ${
            post
              ? `<button type="button" data-cal-schedule>Agendar</button>
                 ${profileLock ? "" : `<button type="button" data-cal-publish>Publicar agora</button>`}
                 <button type="button" class="danger" data-cal-delete>Excluir</button>`
              : ""
          }
        </div>
      </form>
    `;
  }

  async function renderReminderEditor() {
    const reminder = editingReminderId
      ? reminders.find((item) => item.id === editingReminderId) ||
        (await fetchReminder(editingReminderId))
      : null;
    const scheduled = reminder
      ? toLocalInput(reminder.scheduledAt)
      : defaultWhen(new Date(`${selectedDay}T00:00:00`));
    side.innerHTML = `
      <form class="cal-editor" id="cal-reminder-editor">
        <div class="cal-side-head">
          <h3>${reminder ? "Editar lembrete" : "Novo lembrete"}</h3>
          <a href="${hrefFor(homeRoute())}" data-cal-cancel>Fechar</a>
        </div>
        <label>Título
          <input name="title" required maxlength="200" value="${escapeHtml(reminder?.title || "")}" placeholder="Ex.: Filmar depoimento" />
        </label>
        <label>Quando
          <input name="scheduledAt" type="datetime-local" required value="${escapeHtml(scheduled)}" />
        </label>
        <label>Notas
          <textarea name="notes" rows="4" maxlength="4000" placeholder="Opcional">${escapeHtml(reminder?.notes || "")}</textarea>
        </label>
        <div class="actions cal-editor-actions">
          <button type="submit">${reminder ? "Salvar" : "Criar"}</button>
          ${
            reminder
              ? `<button type="button" data-cal-reminder-toggle>${reminder.status === "done" ? "Reabrir" : "Marcar feito"}</button>
                 <button type="button" class="danger" data-cal-reminder-delete>Excluir</button>`
              : ""
          }
        </div>
      </form>
    `;
  }

  async function renderCarouselSkill() {
    rememberCarouselFields();
    const owners = profileLock ? [] : await fetchOwners();
    const scheduled =
      carouselWhen || defaultWhen(new Date(`${selectedDay}T00:00:00`));
    const ownerValue = profileLock
      ? `${profileLock.kind}:${profileLock.id}`
      : carouselOwner;
    let sourceUrl = carouselUrl;
    if (!sourceUrl) {
      const parsed = profileLock || parseOwnerValue(ownerValue);
      if (parsed) {
        const profile = await fetchProfile(parsed.kind, parsed.id);
        sourceUrl = ownerLink(profile);
        lastPrefillUrl = sourceUrl;
        carouselUrl = sourceUrl;
      }
    }
    side.innerHTML = `
      <form class="cal-editor" id="cal-carousel-editor">
        <div class="cal-side-head">
          <h3>Carrossel do lead</h3>
          <button type="button" data-cal-back-pick>Voltar</button>
        </div>
        ${renderOwnerFields(ownerValue, owners, true)}
        <label>Link
          <input name="sourceUrl" required maxlength="2000" inputmode="url" value="${escapeHtml(sourceUrl)}" placeholder="https://www.instagram.com/perfil/ ou https://site.com" />
        </label>
        <label>Quando
          <input name="scheduledAt" type="datetime-local" required value="${escapeHtml(scheduled)}" />
        </label>
        <label>Notas
          <textarea name="notes" rows="3" maxlength="4000" placeholder="Tom, oferta ou CTA. Opcional.">${escapeHtml(carouselNotes)}</textarea>
        </label>
        <label>Slides
          <select name="slideCount">
            ${[3, 4, 5, 6, 7]
              .map(
                (count) =>
                  `<option value="${count}" ${count === carouselSlideCount ? "selected" : ""}>${count}</option>`,
              )
              .join("")}
          </select>
        </label>
        <div class="actions cal-editor-actions">
          <button type="submit" ${carouselBusy ? "disabled" : ""}>${carouselBusy ? "Gerando…" : "Gerar carrossel"}</button>
        </div>
      </form>
    `;
  }

  async function renderIdeasSkill() {
    rememberIdeasNotes();
    const owners = profileLock ? [] : await fetchOwners();
    rememberIdeasOwner();
    const scheduled =
      ideasWhen || defaultWhen(new Date(`${selectedDay}T00:00:00`));
    const ownerValue = profileLock
      ? `${profileLock.kind}:${profileLock.id}`
      : ideasOwner;
    side.innerHTML = `
      <form class="cal-editor" id="cal-ideas-editor">
        <div class="cal-side-head">
          <h3>Ideias da semana</h3>
          <button type="button" data-cal-back-pick>Voltar</button>
        </div>
        ${renderOwnerFields(ownerValue, owners, true)}
        <label>Quando começa
          <input name="scheduledAt" type="datetime-local" required value="${escapeHtml(scheduled)}" />
        </label>
        ${renderIdeasBlock()}
      </form>
    `;
  }

  function parseOwnerValue(
    value: string,
  ): { kind: "lead" | "customer"; id: string } | null {
    if (value.startsWith("lead:") && value.length > 5) {
      return { kind: "lead", id: value.slice(5) };
    }
    if (value.startsWith("customer:") && value.length > 9) {
      return { kind: "customer", id: value.slice(9) };
    }
    return null;
  }

  async function fetchProfile(
    kind: "lead" | "customer",
    id: string,
  ): Promise<Lead | null> {
    const path =
      kind === "lead"
        ? `/leads/${encodeURIComponent(id)}`
        : `/customers/${encodeURIComponent(id)}`;
    const res = await api(path);
    if (!res.ok) return null;
    return (await res.json()) as Lead;
  }

  function ownerLink(profile: Lead | null): string {
    const ig = (profile?.instagram || "").trim();
    if (ig) {
      if (/^https?:\/\//i.test(ig)) return ig;
      if (/instagram\.com/i.test(ig)) return `https://${ig.replace(/^\/+/, "")}`;
      return `https://www.instagram.com/${ig.replace(/^@+/, "")}/`;
    }
    const site = (profile?.website || "").trim();
    if (!site) return "";
    return /^https?:\/\//i.test(site) ? site : `https://${site}`;
  }

  function rememberCarouselFields() {
    const form = document.getElementById(
      "cal-carousel-editor",
    ) as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    carouselUrl = String(data.get("sourceUrl") || "");
    carouselNotes = String(data.get("notes") || "");
    carouselOwner = String(data.get("owner") || "");
    carouselSlideCount = Number(data.get("slideCount") || 5) || 5;
    const local = String(data.get("scheduledAt") || "");
    if (local) carouselWhen = local;
  }

  function formatLabel(format: string): string {
    if (format === "carousel") return "Carrossel";
    if (format === "reel") return "Reel";
    if (format === "static") return "Estático";
    return format;
  }

  function renderIdeasBlock(): string {
    const cards = ideasPack?.ideas.length
      ? ideasPack.ideas
          .map(
            (idea, index) => `
          <article class="cal-idea" data-idea-index="${index}">
            <p class="cal-idea-kicker">${escapeHtml(formatLabel(idea.format))}${idea.commentKeyword ? ` · ${escapeHtml(idea.commentKeyword)}` : ""}</p>
            <strong>${escapeHtml(idea.title)}</strong>
            <p>${escapeHtml(idea.hook)}</p>
            <div class="cal-idea-actions">
              <button type="button" data-idea-use="${index}">Usar nesta peça</button>
              <button type="button" data-idea-pack="${index}">Abrir pack</button>
            </div>
          </article>`,
          )
          .join("")
      : `<p class="prompt-hint">Gere dores, hooks e 5 ideias. Copy only — sem mídia.</p>`;
    const pains = ideasPack?.pains.length
      ? `<p class="cal-idea-pains">${ideasPack.pains
          .slice(0, 4)
          .map((pain) => escapeHtml(pain))
          .join(" · ")}</p>`
      : "";
    return `
      <div class="cal-ideas" id="cal-ideas">
        <strong>Ideias do perfil</strong>
        <label>Notas
          <textarea id="cal-ideas-notes" rows="2" maxlength="4000" placeholder="Tom, oferta ou palavra-chave do comentário.">${escapeHtml(ideasNotes)}</textarea>
        </label>
        <div class="cal-idea-actions">
          <button type="button" data-cal-ideas ${ideasBusy ? "disabled" : ""}>${ideasBusy ? "Gerando…" : "Gerar ideias"}</button>
          <button type="button" data-cal-ideas-drafts ${!ideasPack?.ideas.length || ideasBusy ? "disabled" : ""}>Criar rascunhos da semana</button>
        </div>
        ${pains}
        <div class="cal-idea-list">${cards}</div>
      </div>
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

  function rememberIdeasNotes() {
    const notes = document.getElementById("cal-ideas-notes") as HTMLTextAreaElement | null;
    if (notes) ideasNotes = notes.value;
  }

  function rememberIdeasOwner() {
    const form = document.getElementById(
      "cal-ideas-editor",
    ) as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    ideasOwner = String(data.get("owner") || "");
    const local = String(data.get("scheduledAt") || "");
    if (local) ideasWhen = local;
  }

  function emptyOwner() {
    return {
      title: "",
      caption: "",
      scheduledAt: "",
      platforms: ["instagram"] as CalendarPlatform[],
      leadId: profileLock?.kind === "lead" ? profileLock.id : null,
      customerId: profileLock?.kind === "customer" ? profileLock.id : null,
    };
  }

  function ownerFromEditor(): {
    title: string;
    caption: string;
    scheduledAt: string;
    platforms: CalendarPlatform[];
    leadId: string | null;
    customerId: string | null;
  } {
    const form =
      (document.getElementById("cal-editor") as HTMLFormElement | null) ||
      (document.getElementById("cal-ideas-editor") as HTMLFormElement | null) ||
      (document.getElementById("cal-carousel-editor") as HTMLFormElement | null);
    if (!form) return emptyOwner();
    return readFormOwner(form);
  }

  async function generateIdeas() {
    rememberIdeasNotes();
    rememberIdeasOwner();
    const owner = ownerFromEditor();
    if (!owner.leadId && !owner.customerId) {
      setStatus("Escolha um perfil para gerar ideias.", true);
      return;
    }
    ideasBusy = true;
    setStatus("Gerando ideias…");
    await renderIdeasSkill();
    const res = await api("/calendar/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: owner.leadId,
        customerId: owner.customerId,
        notes: ideasNotes,
      }),
    });
    ideasBusy = false;
    if (!res.ok) {
      setStatus(await readError(res, "Não gerou as ideias"), true);
      await renderIdeasSkill();
      return;
    }
    ideasPack = (await res.json()) as CalendarIdeasSpec;
    setStatus("Ideias prontas.");
    await renderIdeasSkill();
  }

  async function createIdeaDrafts() {
    rememberIdeasNotes();
    rememberIdeasOwner();
    const owner = ownerFromEditor();
    if (!owner.leadId && !owner.customerId) {
      setStatus("Escolha um perfil para criar os rascunhos.", true);
      return;
    }
    if (!ideasPack?.ideas.length) {
      setStatus("Gere as ideias primeiro.", true);
      return;
    }
    ideasBusy = true;
    setStatus("Criando rascunhos…");
    await renderIdeasSkill();
    const res = await api("/calendar/posts/from-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: owner.leadId,
        customerId: owner.customerId,
        platforms: owner.platforms.length ? owner.platforms : ["instagram"],
        startAt: owner.scheduledAt || undefined,
        ideas: ideasPack.ideas,
      }),
    });
    ideasBusy = false;
    if (!res.ok) {
      setStatus(await readError(res, "Não criou os rascunhos"), true);
      await renderIdeasSkill();
      return;
    }
    creating = false;
    creatingMode = "pick";
    setStatus("Rascunhos da semana criados.");
    await refresh();
  }

  function applyIdea(index: number) {
    const idea = ideasPack?.ideas[index];
    if (!idea) return;
    const form = document.getElementById("cal-editor") as HTMLFormElement | null;
    const title = form?.querySelector<HTMLInputElement>('input[name="title"]');
    const caption = form?.querySelector<HTMLTextAreaElement>('textarea[name="caption"]');
    if (title && caption) {
      title.value = idea.title;
      caption.value = idea.caption;
      setStatus("Ideia aplicada no título e na legenda.");
      return;
    }
    pendingIdea = idea;
    creatingMode = "manual";
    setStatus("Ideia aplicada no título e na legenda.");
    void renderEditor();
  }

  function openIdeaPack(index: number) {
    const idea = ideasPack?.ideas[index];
    if (!idea) return;
    const owner = ownerFromEditor();
    saveRepurposeDraft({
      prompt: `${idea.hook}\n\n${idea.caption}`,
      notes: [ideasNotes, idea.commentKeyword ? `CTA: comenta ${idea.commentKeyword}` : ""]
        .filter(Boolean)
        .join("\n"),
      leadId: owner.leadId || undefined,
      hook: idea.hook,
      cta: idea.commentKeyword ? `Comenta ${idea.commentKeyword}` : "Salve este post",
    });
    navigate({ name: "criativo-skill", id: "carousel-instagram" });
  }

  function readFormOwner(form: HTMLFormElement): {
    title: string;
    caption: string;
    scheduledAt: string;
    platforms: CalendarPlatform[];
    leadId: string | null;
    customerId: string | null;
  } {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const caption = String(data.get("caption") || "").trim();
    const local = String(data.get("scheduledAt") || "");
    const scheduledAt = local ? new Date(local).toISOString() : "";
    let platforms = [...form.querySelectorAll<HTMLInputElement>('input[name="platform"]:checked')].map(
      (input) => input.value as CalendarPlatform,
    );
    if (!platforms.length) {
      const hidden = String(data.get("platform") || "");
      if (hidden) platforms = [hidden as CalendarPlatform];
    }
    const owner = String(data.get("owner") || "");
    let leadId: string | null = null;
    let customerId: string | null = null;
    if (owner.startsWith("lead:")) leadId = owner.slice(5);
    if (owner.startsWith("customer:")) customerId = owner.slice(9);
    if (profileLock) {
      platforms = ["instagram"];
      leadId = profileLock.kind === "lead" ? profileLock.id : null;
      customerId = profileLock.kind === "customer" ? profileLock.id : null;
    }
    return { title, caption, scheduledAt, platforms, leadId, customerId };
  }

  function readEditor(): {
    title: string;
    caption: string;
    scheduledAt: string;
    platforms: CalendarPlatform[];
    leadId: string | null;
    customerId: string | null;
  } {
    return readFormOwner(requireEl<HTMLFormElement>("cal-editor"));
  }

  async function fetchReminder(id: string): Promise<CalendarReminder> {
    const res = await api(`/calendar/reminders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Lembrete não encontrado"));
    const reminder = (await res.json()) as CalendarReminder;
    const index = reminders.findIndex((item) => item.id === reminder.id);
    if (index >= 0) reminders[index] = reminder;
    else reminders.push(reminder);
    return reminder;
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
    creatingMode = "pick";
    editingId = post.id;
    editingReminderId = null;
    navigate(postRoute(post.id));
    setStatus("Post salvo.");
    await refresh();
  }

  async function saveCarousel(event: SubmitEvent) {
    event.preventDefault();
    rememberCarouselFields();
    const form = requireEl<HTMLFormElement>("cal-carousel-editor");
    const data = new FormData(form);
    const sourceUrl = String(data.get("sourceUrl") || "").trim();
    const local = String(data.get("scheduledAt") || "");
    const scheduledAt = local ? new Date(local).toISOString() : "";
    const notes = String(data.get("notes") || "").trim();
    const slideCount = Number(data.get("slideCount") || 5);
    const owner = ownerFromEditor();
    if (!sourceUrl || !scheduledAt) {
      setStatus("Link e data são obrigatórios.", true);
      return;
    }
    if (!owner.leadId && !owner.customerId) {
      setStatus("Escolha um perfil para gerar o carrossel.", true);
      return;
    }
    carouselBusy = true;
    setStatus("Gerando carrossel… Isso pode levar alguns minutos.");
    await renderCarouselSkill();
    const res = await api("/calendar/posts/from-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceUrl,
        scheduledAt,
        notes,
        slideCount,
        leadId: owner.leadId,
        customerId: owner.customerId,
      }),
    });
    carouselBusy = false;
    if (!res.ok) {
      setStatus(await readError(res, "Não gerou o carrossel"), true);
      await renderCarouselSkill();
      return;
    }
    const post = (await res.json()) as CalendarPost;
    creating = false;
    creatingMode = "pick";
    editingId = post.id;
    editingReminderId = null;
    navigate(postRoute(post.id));
    setStatus("Rascunho pronto. Revise e agende.");
    await refresh();
  }

  async function saveReminderEditor(event: SubmitEvent) {
    event.preventDefault();
    if (!profileLock) {
      setStatus("Lembretes só na agenda do perfil.", true);
      return;
    }
    const form = requireEl<HTMLFormElement>("cal-reminder-editor");
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const notes = String(data.get("notes") || "").trim();
    const local = String(data.get("scheduledAt") || "");
    const scheduledAt = local ? new Date(local).toISOString() : "";
    if (!title || !scheduledAt) {
      setStatus("Título e data são obrigatórios.", true);
      return;
    }
    const body = {
      title,
      notes,
      scheduledAt,
      leadId: profileLock.kind === "lead" ? profileLock.id : undefined,
      customerId: profileLock.kind === "customer" ? profileLock.id : undefined,
    };
    setStatus(editingReminderId ? "Salvando…" : "Criando…");
    const res = editingReminderId
      ? await api(`/calendar/reminders/${encodeURIComponent(editingReminderId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await api("/calendar/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!res.ok) {
      setStatus(await readError(res, "Não salvou o lembrete"), true);
      return;
    }
    const reminder = (await res.json()) as CalendarReminder;
    creating = false;
    creatingKind = "post";
    editingReminderId = reminder.id;
    editingId = null;
    setStatus("Lembrete salvo.");
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
    if (editingReminderId) {
      try {
        await fetchReminder(editingReminderId);
      } catch {
        editingReminderId = null;
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
    creatingKind = "post";
    creatingMode = "pick";
    editingId = null;
    editingReminderId = null;
    navigate(homeRoute());
    renderGrid();
    renderSide();
  });

  side.addEventListener("click", (event) => {
    const node = event.target as HTMLElement | null;
    if (node?.closest("[data-cal-new-day]")) {
      event.preventDefault();
      startCreatePost();
      renderPicker();
      return;
    }
    const modeBtn = node?.closest("[data-cal-mode]") as HTMLElement | null;
    if (modeBtn?.dataset.calMode) {
      event.preventDefault();
      creatingMode = modeBtn.dataset.calMode as CreatingMode;
      renderCompose();
      return;
    }
    if (node?.closest("[data-cal-back-pick]")) {
      event.preventDefault();
      rememberCarouselFields();
      rememberIdeasNotes();
      rememberIdeasOwner();
      creatingMode = "pick";
      renderPicker();
      return;
    }
    if (node?.closest("[data-cal-new-reminder-day]")) {
      event.preventDefault();
      creating = true;
      creatingKind = "reminder";
      editingId = null;
      editingReminderId = null;
      void renderReminderEditor();
      return;
    }
    const open = node?.closest("[data-open-post]") as HTMLElement | null;
    if (open?.dataset.openPost) {
      event.preventDefault();
      creating = false;
      creatingKind = "post";
      editingId = open.dataset.openPost;
      editingReminderId = null;
      navigate(postRoute(editingId));
      void renderEditor();
      return;
    }
    const openReminder = node?.closest("[data-open-reminder]") as HTMLElement | null;
    if (openReminder?.dataset.openReminder) {
      event.preventDefault();
      creating = false;
      creatingKind = "reminder";
      editingId = null;
      editingReminderId = openReminder.dataset.openReminder;
      navigate(homeRoute());
      void renderReminderEditor();
      return;
    }
    if (node?.closest("[data-cal-cancel]")) {
      event.preventDefault();
      creating = false;
      creatingKind = "post";
      creatingMode = "pick";
      editingId = null;
      editingReminderId = null;
      navigate(homeRoute());
      renderSide();
      return;
    }
    if (node?.closest("[data-cal-ideas]")) {
      event.preventDefault();
      void generateIdeas();
      return;
    }
    if (node?.closest("[data-cal-ideas-drafts]")) {
      event.preventDefault();
      void createIdeaDrafts();
      return;
    }
    const useIdea = node?.closest("[data-idea-use]") as HTMLElement | null;
    if (useIdea?.dataset.ideaUse != null) {
      event.preventDefault();
      applyIdea(Number(useIdea.dataset.ideaUse));
      return;
    }
    const packIdea = node?.closest("[data-idea-pack]") as HTMLElement | null;
    if (packIdea?.dataset.ideaPack != null) {
      event.preventDefault();
      openIdeaPack(Number(packIdea.dataset.ideaPack));
    }
  });

  side.addEventListener("submit", (event) => {
    const id = (event.target as HTMLElement).id;
    if (id === "cal-editor") {
      void saveEditor(event as SubmitEvent);
      return;
    }
    if (id === "cal-carousel-editor") {
      void saveCarousel(event as SubmitEvent);
      return;
    }
    if (id === "cal-ideas-editor") {
      event.preventDefault();
      return;
    }
    if (id === "cal-reminder-editor") {
      void saveReminderEditor(event as SubmitEvent);
    }
  });

  side.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!input) return;
    if (input instanceof HTMLSelectElement && input.name === "owner") {
      const form = input.form;
      if (form?.id === "cal-carousel-editor") {
        void onCarouselOwnerChange();
        return;
      }
      if (form?.id === "cal-ideas-editor") {
        rememberIdeasOwner();
      }
    }
    if (!editingId) return;
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
        creatingMode = "pick";
        navigate(homeRoute());
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

  side.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("button") as HTMLButtonElement | null;
    if (!btn || !editingReminderId) return;
    if (btn.dataset.calReminderToggle !== undefined) {
      const reminder = reminders.find((item) => item.id === editingReminderId);
      const next = reminder?.status === "done" ? "open" : "done";
      void (async () => {
        const res = await api(`/calendar/reminders/${encodeURIComponent(editingReminderId!)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          setStatus(await readError(res, "Não atualizou o lembrete"), true);
          return;
        }
        await refresh();
        setStatus(next === "done" ? "Lembrete concluído." : "Lembrete reaberto.");
      })();
      return;
    }
    if (btn.dataset.calReminderDelete !== undefined) {
      if (!window.confirm("Excluir este lembrete?")) return;
      void (async () => {
        const res = await api(`/calendar/reminders/${encodeURIComponent(editingReminderId!)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setStatus(await readError(res, "Não excluiu"), true);
          return;
        }
        editingReminderId = null;
        creating = false;
        navigate(homeRoute());
        setStatus("Lembrete excluído.");
        await refresh();
      })();
    }
  });

  function startCreatePost() {
    creating = true;
    creatingKind = "post";
    creatingMode = "pick";
    editingId = null;
    editingReminderId = null;
    carouselBusy = false;
  }

  async function onCarouselOwnerChange() {
    rememberCarouselFields();
    const parsed = parseOwnerValue(carouselOwner);
    if (parsed) {
      const profile = await fetchProfile(parsed.kind, parsed.id);
      const next = ownerLink(profile);
      if (!carouselUrl.trim() || carouselUrl.trim() === lastPrefillUrl) {
        carouselUrl = next;
        lastPrefillUrl = next;
      }
    }
    await renderCarouselSkill();
  }

  newBtn.addEventListener("click", () => {
    startCreatePost();
    selectedDay = dayKey(new Date());
    renderPicker();
  });
  reminderBtn.addEventListener("click", () => {
    creating = true;
    creatingKind = "reminder";
    editingId = null;
    editingReminderId = null;
    selectedDay = dayKey(new Date());
    void renderReminderEditor();
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
    if (!isCalendarRoute(route)) return;
    profileLock = profileLockOf(route);
    applyChrome();
    try {
      await loadCaps();
      const postId =
        route.name === "calendar-post"
          ? route.id
          : route.name === "lead-calendar-post" ||
              route.name === "customer-calendar-post"
            ? route.postId
            : null;
      if (postId) {
        editingId = postId;
        editingReminderId = null;
        creating = false;
        creatingKind = "post";
        creatingMode = "pick";
        const post = await fetchPost(postId);
        month = startOfMonth(new Date(post.scheduledAt));
        selectedDay = postDayKey(post);
        document.title = titleForRoute(route, post.title);
      } else if (!creating) {
        editingId = null;
        if (route.name === "calendar" || route.name === "lead-calendar" || route.name === "customer-calendar") {
          editingReminderId = creatingKind === "reminder" ? editingReminderId : null;
        }
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
