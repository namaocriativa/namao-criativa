import './chrome';
import { api, setSession } from './session';

const form = document.getElementById('login-form') as HTMLFormElement;
const statusEl = document.getElementById('login-status') as HTMLElement;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  statusEl.textContent = 'Entrando…';
  statusEl.classList.remove('error');
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: String(fd.get('email') || ''),
        password: String(fd.get('password') || ''),
      }),
    });
    setSession(data.accessToken);
    location.href = '/dashboard.html';
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : 'Falha no login';
    statusEl.classList.add('error');
  }
});
