import './chrome';
import { api, clearSession, getToken } from './session';

type MeResponse = {
  user?: { name?: string; email?: string };
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
  } | null;
};

const userLine = document.getElementById('user-line') as HTMLElement;
const dashTitle = document.getElementById('dash-title') as HTMLElement;
const dashGrid = document.getElementById('dash-grid') as HTMLElement;
const dashStatus = document.getElementById('dash-status') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const businessName = document.getElementById('dash-business-name') as HTMLElement;
const categoryEl = document.getElementById('dash-category') as HTMLElement;
const descriptionEl = document.getElementById('dash-description') as HTMLElement;
const contactEl = document.getElementById('dash-contact') as HTMLElement;
const presenceEl = document.getElementById('dash-presence') as HTMLElement;

if (!getToken()) {
  location.href = '/login.html';
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  location.href = '/login.html';
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

async function boot() {
  try {
    const me = (await api('/auth/me')) as MeResponse;
    const name = me.user?.name || 'Cliente';
    userLine.textContent = `${name} · ${me.user?.email || ''}`;
    dashTitle.textContent = `Olá, ${name.split(' ')[0]}`;
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
      field('Site Namão', lead.publishedOrigin),
      field('Status', landingLabel(lead.landingStatus, lead.publishedOrigin)),
    ].join('');
  } catch {
    clearSession();
    location.href = '/login.html';
  }
}

void boot();
