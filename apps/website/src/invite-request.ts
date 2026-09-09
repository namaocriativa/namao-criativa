import { SIGNUP_MAIL_FAILED, SIGNUP_SUCCESS, createCustomerAccount } from './signup';

function initInviteRequest() {
  const dialog = document.querySelector<HTMLDialogElement>('#invite-dialog');
  const openBtn = document.getElementById('invite-open');
  const closeBtn = document.getElementById('invite-close');
  const form = document.querySelector<HTMLFormElement>('#invite-form');
  const statusEl = document.getElementById('invite-status');
  if (!dialog || !openBtn || !form || !statusEl) return;

  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const setDialogCursor = (open: boolean) => {
    document.body.classList.toggle('dialog-open', open);
  };

  const open = () => {
    statusEl.textContent = '';
    statusEl.classList.remove('error');
    if (submitBtn) submitBtn.disabled = false;
    dialog.showModal();
    setDialogCursor(true);
  };

  const close = () => {
    dialog.close();
    setDialogCursor(false);
  };

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => setDialogCursor(false));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    statusEl.textContent = 'Criando conta e enviando acesso…';
    statusEl.classList.remove('error');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const created = await createCustomerAccount({
        name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        instagram: String(fd.get('instagram') || ''),
      });
      form.reset();
      statusEl.textContent = created.mailed ? SIGNUP_SUCCESS : SIGNUP_MAIL_FAILED;
    } catch (error) {
      statusEl.textContent =
        error instanceof Error ? error.message : 'Não foi possível criar a conta';
      statusEl.classList.add('error');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

initInviteRequest();
