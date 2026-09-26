import './chrome';
import { api, clearSession, probeLoggedIn } from './session';

const userLine = document.getElementById('user-line') as HTMLElement;
const igStatus = document.getElementById('ig-status') as HTMLElement;
const igStart = document.getElementById('ig-start') as HTMLAnchorElement;
const igSync = document.getElementById('ig-sync') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

function instagramErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'no_facebook_pages':
    case 'pages_without_instagram':
    case 'no_instagram_business_account':
    case 'no_instagram_account':
      return 'Não achamos o Instagram dessa conta. Autorize de novo e entre com o Instagram Professional (Business ou Creator).';
    case 'not_professional':
      return 'Essa conta é pessoal. No Instagram: Configurações → Tipo de conta → mudar para Profissional. Não precisa de Facebook Page.';
    case 'user_without_lead':
      return 'Esta conta do site não está vinculada a um lead. Use o convite do Studio.';
    case 'invalid_state':
    case 'missing_code':
      return 'A sessão do OAuth expirou. Tente autorizar de novo.';
    case 'graph_error':
      return 'A Meta recusou o token. Confira App ID/Secret e tente de novo.';
    default:
      return `Falha na autorização: ${reason || 'erro'}`;
  }
}

logoutBtn.addEventListener('click', () => {
  void (async () => {
    await clearSession();
    location.href = '/login.html';
  })();
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
    igStatus.textContent = instagramErrorMessage(params.get('reason'));
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
        'Ainda não autorizado. Use o botão para permitir a leitura das mídias do Instagram.';
    }
  } catch {
    await clearSession();
    location.href = '/login.html';
  }
}

void (async () => {
  if (!(await probeLoggedIn())) {
    location.href = '/login.html';
    return;
  }
  await boot();
})();
