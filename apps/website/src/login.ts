import './chrome';
import { clearChatSession } from './chat/api';
import { api } from './session';
import { SIGNUP_SUCCESS } from './signup';

const form = document.getElementById('login-form') as HTMLFormElement;
const statusEl = document.getElementById('login-status') as HTMLElement;
const submitBtn = document.getElementById('login-btn') as HTMLButtonElement;
const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
const params = new URLSearchParams(location.search);

if (params.get('registered') === '1') {
  statusEl.textContent = SIGNUP_SUCCESS;
  statusEl.classList.remove('error');
}
const registeredEmail = params.get('email')?.trim();
if (registeredEmail && emailInput && !emailInput.value) {
  emailInput.value = registeredEmail;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  statusEl.textContent = 'Entrando…';
  statusEl.classList.remove('error');
  submitBtn.disabled = true;
  try {
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: String(fd.get('email') || ''),
        password: String(fd.get('password') || ''),
      }),
    });
    clearChatSession();
    location.href = '/dashboard.html';
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : 'Falha no login';
    statusEl.classList.add('error');
    submitBtn.disabled = false;
  }
});
