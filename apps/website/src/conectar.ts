import './chrome';
import { api, clearSession, getToken } from './session';

const userLine = document.getElementById('user-line') as HTMLElement;
const igStatus = document.getElementById('ig-status') as HTMLElement;
const igStart = document.getElementById('ig-start') as HTMLAnchorElement;
const igSync = document.getElementById('ig-sync') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

if (!getToken()) {
  location.href = '/login.html';
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  location.href = '/login.html';
});

igStart.addEventListener('click', async (event) => {
  event.preventDefault();
  igStatus.textContent = 'Abrindo autorização Meta…';
  try {
    const data = await api('/auth/instagram/start');
    if (data.url) location.href = data.url;
  } catch (error) {
    igStatus.textContent =
      error instanceof Error ? error.message : 'Não foi possível iniciar o OAuth';
    igStatus.classList.add('error');
  }
});

igSync.addEventListener('click', async () => {
  igStatus.classList.remove('error');
  igStatus.textContent = 'Sincronizando…';
  try {
    const data = await api('/auth/instagram/sync', { method: 'POST' });
    igStatus.textContent = `Mídia: ${data.found ?? 0} encontradas, ${data.imported ?? 0} importadas.`;
  } catch (error) {
    igStatus.textContent =
      error instanceof Error ? error.message : 'Falha na sincronização';
    igStatus.classList.add('error');
  }
});

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('ig') === 'ok') {
    igStatus.textContent = 'Instagram autorizado.';
  }
  if (params.get('ig') === 'error') {
    igStatus.textContent = `Falha na autorização: ${params.get('reason') || 'erro'}`;
    igStatus.classList.add('error');
  }

  try {
    const me = await api('/auth/me');
    userLine.textContent = `${me.user?.name || ''} · ${me.user?.email || ''}`;
    const st = await api('/auth/instagram/status');
    if (st.connected) {
      igStatus.textContent = `Conectado: @${st.connection?.username || st.connection?.igUserId}`;
    } else if (!params.get('ig')) {
      igStatus.textContent =
        'Ainda não autorizado. Use o botão para permitir a leitura do perfil via Graph API.';
    }
  } catch {
    clearSession();
    location.href = '/login.html';
  }
}

void boot();
