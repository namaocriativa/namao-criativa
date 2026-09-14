import './chrome';
import { clearChatSession, mountWebsiteChat } from './chat/mount';
import { api, clearSession, probeLoggedIn } from './session';

type MeResponse = {
  user?: { name?: string; email?: string };
  accountKind?: 'lead' | 'customer' | null;
  contactWhatsAppUrl?: string | null;
  instagram?: {
    connected: boolean;
    username?: string | null;
    igUserId?: string | null;
  };
  lead?: {
    name?: string | null;
    category?: string | null;
    description?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    city?: string | null;
    state?: string | null;
    website?: string | null;
    publishedOrigin?: string | null;
    landingStatus?: string | null;
    createdAt?: string | null;
  } | null;
};

type AnalyticsRange = '7d' | '28d' | '90d';

type AnalyticsResponse =
  | {
      status: 'ok' | 'empty';
      hostname: string;
      range: AnalyticsRange;
      kpis: {
        users: number;
        sessions: number;
        pageviews: number;
        engagementRate: number;
      };
      topPages: Array<{ path: string; views: number }>;
      channels: Array<{ name: string; sessions: number }>;
    }
  | { status: 'unpublished' }
  | { status: 'unconfigured' }
  | { status: 'error'; message?: string };

const userLine = document.getElementById('user-line') as HTMLElement;
const dashKicker = document.getElementById('dash-kicker') as HTMLElement;
const dashTitle = document.getElementById('dash-title') as HTMLElement;
const dashGrid = document.getElementById('dash-grid') as HTMLElement;
const dashStatus = document.getElementById('dash-status') as HTMLElement;
const dashTrial = document.getElementById('dash-trial') as HTMLElement;
const dashTrialDeadline = document.getElementById(
  'dash-trial-deadline',
) as HTMLElement;
const dashContact = document.getElementById('dash-contact') as HTMLAnchorElement;
const dashIgCard = document.getElementById('dash-ig-card') as HTMLElement;
const dashIgStatus = document.getElementById('dash-ig-status') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const businessName = document.getElementById('dash-business-name') as HTMLElement;
const categoryEl = document.getElementById('dash-category') as HTMLElement;
const descriptionEl = document.getElementById('dash-description') as HTMLElement;
const contactEl = document.getElementById('dash-contact-dl') as HTMLElement;
const presenceEl = document.getElementById('dash-presence') as HTMLElement;
const statsSection = document.getElementById('dash-stats') as HTMLElement;
const statsStatus = document.getElementById('dash-stats-status') as HTMLElement;
const statsHost = document.getElementById('dash-stats-host') as HTMLElement;
const kpisEl = document.getElementById('dash-kpis') as HTMLElement;
const statsSplit = document.getElementById('dash-stats-split') as HTMLElement;
const topPagesEl = document.getElementById('dash-top-pages') as HTMLElement;
const channelsEl = document.getElementById('dash-channels') as HTMLElement;
const rangeGroup = document.getElementById('dash-range') as HTMLElement;
const kpiUsers = document.getElementById('kpi-users') as HTMLElement;
const kpiSessions = document.getElementById('kpi-sessions') as HTMLElement;
const kpiPageviews = document.getElementById('kpi-pageviews') as HTMLElement;
const kpiEngagement = document.getElementById('kpi-engagement') as HTMLElement;

let selectedRange: AnalyticsRange = '7d';

void (async () => {
  if (!(await probeLoggedIn())) {
    location.href = '/login.html';
    return;
  }
  mountWebsiteChat();
  await boot();
})();

logoutBtn.addEventListener('click', () => {
  void (async () => {
    await clearSession();
    clearChatSession();
    location.href = '/login.html';
  })();
});

rangeGroup.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest('button[data-range]');
  if (!(button instanceof HTMLButtonElement)) return;
  const next = button.dataset.range;
  if (next !== '7d' && next !== '28d' && next !== '90d') return;
  selectedRange = next;
  for (const item of rangeGroup.querySelectorAll('button[data-range]')) {
    item.classList.toggle('is-active', item === button);
  }
  void loadAnalytics();
});

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function field(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function linkField(label: string, href: string | null | undefined, text?: string) {
  if (!href) return '';
  const labelText = text || href;
  return `<div><dt>${escapeHtml(label)}</dt><dd><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(labelText)}</a></dd></div>`;
}

const TRIAL_DAYS = 7;

function trialEndsAt(createdAt: string | null | undefined): Date | null {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

function formatTrialDeadline(createdAt: string | null | undefined): string {
  const ends = trialEndsAt(createdAt);
  if (!ends) {
    return `Seu site de preview será excluído em até ${TRIAL_DAYS} dias caso o pagamento não seja realizado.`;
  }
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(ends);
  if (ends.getTime() < Date.now()) {
    return `O prazo de ${TRIAL_DAYS} dias já passou. Entre em contato para não perder o site de preview.`;
  }
  return `Seu site de preview será excluído em até ${TRIAL_DAYS} dias (até ${formatted}) caso o pagamento não seja realizado.`;
}

function landingLabel(status: string | null | undefined, published?: string | null) {
  if (published) return 'publicado';
  const labels: Record<string, string> = {
    none: 'sem site',
    scaffolded: 'em preparação',
    generating: 'gerando',
    built: 'pronto',
    published: 'publicado',
    error: 'erro na geração',
  };
  return labels[status || 'none'] || status || 'sem site';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function rankList(
  items: Array<{ label: string; value: string }>,
  empty: string,
): string {
  if (!items.length) return `<li>${escapeHtml(empty)}</li>`;
  return items
    .map(
      (item) =>
        `<li><em>${escapeHtml(item.label)}</em><span>${escapeHtml(item.value)}</span></li>`,
    )
    .join('');
}

function resetStatsView(message: string) {
  statsStatus.textContent = message;
  statsHost.textContent = '';
  kpisEl.hidden = true;
  statsSplit.hidden = true;
}

async function loadAnalytics() {
  resetStatsView('Carregando visitas…');
  try {
    const data = (await api(
      `/dashboard/analytics?range=${encodeURIComponent(selectedRange)}`,
    )) as AnalyticsResponse;
    if (data.status === 'unpublished') {
      resetStatsView(
        'As estatísticas aparecem quando o site Namão estiver publicado.',
      );
      return;
    }
    if (data.status === 'unconfigured') {
      resetStatsView('Analytics ainda não está configurado neste ambiente.');
      return;
    }
    if (data.status === 'error') {
      resetStatsView(
        data.message || 'Não foi possível ler as estatísticas agora.',
      );
      return;
    }
    statsHost.textContent = data.hostname;
    kpiUsers.textContent = formatNumber(data.kpis.users);
    kpiSessions.textContent = formatNumber(data.kpis.sessions);
    kpiPageviews.textContent = formatNumber(data.kpis.pageviews);
    kpiEngagement.textContent = formatRate(data.kpis.engagementRate);
    topPagesEl.innerHTML = rankList(
      data.topPages.map((item) => ({
        label: item.path,
        value: formatNumber(item.views),
      })),
      'Nenhuma página ainda',
    );
    channelsEl.innerHTML = rankList(
      data.channels.map((item) => ({
        label: item.name,
        value: formatNumber(item.sessions),
      })),
      'Nenhum canal ainda',
    );
    kpisEl.hidden = false;
    statsSplit.hidden = false;
    statsStatus.textContent =
      data.status === 'empty'
        ? 'Ainda sem visitas neste período. O GA4 pode atrasar até 24h após a publicação.'
        : '';
  } catch (error) {
    if (error instanceof Error && /401|403/.test(error.message)) {
      await clearSession();
      location.href = '/login.html';
      return;
    }
    resetStatsView(
      error instanceof Error
        ? error.message
        : 'Não foi possível ler as estatísticas agora.',
    );
  }
}

async function boot() {
  try {
    const me = (await api('/auth/me')) as MeResponse;
    const name = me.user?.name || 'Cliente';
    const isLead = me.accountKind === 'lead';
    userLine.textContent = `${name} · ${me.user?.email || ''}`;
    dashTitle.textContent = `Olá, ${name.split(' ')[0]}`;
    dashKicker.textContent = isLead ? 'Prévia da conta' : 'Área do cliente';
    const lead = me.lead;
    if (!lead) {
      dashStatus.textContent =
        'Conta ativa. Os dados do negócio aparecem aqui quando o lead estiver vinculado.';
      return;
    }
    dashGrid.hidden = false;
    businessName.textContent = lead.name || 'Seu negócio';
    categoryEl.textContent = lead.category || '';
    descriptionEl.textContent = lead.description || '';
    contactEl.innerHTML = [
      field('E-mail', lead.email),
      field('Telefone', lead.phone),
      field('WhatsApp', lead.whatsapp),
      field('Instagram', lead.instagram),
    ].join('');
    const place = [lead.city, lead.state].filter(Boolean).join(' / ');
    presenceEl.innerHTML = [
      field('Cidade', place || null),
      field('Website', lead.website),
      lead.publishedOrigin
        ? linkField('Site de preview', lead.publishedOrigin, 'Abrir preview')
        : field('Site Namão', 'ainda sem preview'),
      field('Status', landingLabel(lead.landingStatus, lead.publishedOrigin)),
    ].join('');

    if (isLead) {
      dashTrial.hidden = false;
      dashTrialDeadline.textContent = formatTrialDeadline(lead.createdAt);
      if (me.contactWhatsAppUrl) {
        dashContact.hidden = false;
        dashContact.href = me.contactWhatsAppUrl;
      }
      dashIgCard.hidden = false;
      dashIgStatus.textContent = me.instagram?.connected
        ? `Conectado: @${me.instagram.username || me.instagram.igUserId}`
        : 'Ainda não autorizado. Conecte o Instagram para liberar mídia no site.';
      statsSection.hidden = true;
      return;
    }

    dashTrial.hidden = true;
    dashIgCard.hidden = true;
    statsSection.hidden = false;
    await loadAnalytics();
  } catch {
    await clearSession();
    location.href = '/login.html';
  }
}
