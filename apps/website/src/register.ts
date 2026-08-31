import './chrome';
import { api, setSession } from './session';

const form = document.getElementById('register-form') as HTMLFormElement;
const hint = document.getElementById('invite-hint') as HTMLElement;
const statusEl = document.getElementById('register-status') as HTMLElement;
const params = new URLSearchParams(location.search);
const invite = params.get('invite') || '';

async function loadInvite() {
  if (!invite) {
    hint.textContent =
      'É necessário um convite. Se você recebeu um link da Namão, use-o para abrir esta página.';
    form.querySelectorAll('input, button').forEach((el) => {
      (el as HTMLInputElement).disabled = true;
    });
    return;
  }
  try {
    const data = await api(`/invites/${encodeURIComponent(invite)}`);
    if (data.status !== 'PENDING') {
      hint.textContent = `Este convite está ${String(data.status).toLowerCase()}.`;
      return;
    }
    hint.textContent = `Convite para ${data.lead?.name || 'o seu negócio'}.`;
  } catch (error) {
    hint.textContent =
      error instanceof Error ? error.message : 'Convite inválido';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  statusEl.textContent = 'Criando conta…';
  statusEl.classList.remove('error');
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        inviteToken: invite,
        name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        password: String(fd.get('password') || ''),
      }),
    });
    setSession(data.accessToken);
    location.href = '/conectar.html';
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : 'Falha no cadastro';
    statusEl.classList.add('error');
  }
});

void loadInvite();
