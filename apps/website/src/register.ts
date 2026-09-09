import './chrome';
import { api } from './session';
import { SIGNUP_MAIL_FAILED, createCustomerAccount } from './signup';

const form = document.getElementById('register-form') as HTMLFormElement;
const hint = document.getElementById('invite-hint') as HTMLElement;
const statusEl = document.getElementById('register-status') as HTMLElement;
const submitBtn = document.getElementById('register-btn') as HTMLButtonElement;
const params = new URLSearchParams(location.search);
let inviteToken = params.get('invite') || '';

async function loadInviteHint() {
  if (!inviteToken) {
    hint.textContent = 'A senha e o link de acesso chegam no e-mail.';
    return;
  }
  try {
    const data = await api(`/invites/${encodeURIComponent(inviteToken)}`);
    if (data.status !== 'PENDING') {
      inviteToken = '';
      hint.textContent = 'A senha e o link de acesso chegam no e-mail.';
      return;
    }
    hint.textContent = `Convite para ${data.lead?.name || 'o seu negócio'}. A senha chega no e-mail.`;
  } catch {
    inviteToken = '';
    hint.textContent = 'A senha e o link de acesso chegam no e-mail.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  statusEl.textContent = 'Criando conta e enviando acesso…';
  statusEl.classList.remove('error');
  submitBtn.disabled = true;
  try {
    const created = await createCustomerAccount({
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      instagram: String(fd.get('instagram') || ''),
      inviteToken,
    });
    if (created.mailed) {
      const email = String(fd.get('email') || '').trim();
      const next = new URL('/login.html', location.origin);
      next.searchParams.set('registered', '1');
      if (email) next.searchParams.set('email', email);
      location.href = `${next.pathname}${next.search}`;
      return;
    }
    statusEl.textContent = SIGNUP_MAIL_FAILED;
    submitBtn.disabled = false;
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : 'Falha no cadastro';
    statusEl.classList.add('error');
    submitBtn.disabled = false;
  }
});

void loadInviteHint();
