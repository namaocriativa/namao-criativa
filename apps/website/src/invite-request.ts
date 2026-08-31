function initInviteRequest() {
  const dialog = document.querySelector<HTMLDialogElement>('#invite-dialog');
  const openBtn = document.getElementById('invite-open');
  const closeBtn = document.getElementById('invite-close');
  const form = document.querySelector<HTMLFormElement>('#invite-form');
  const statusEl = document.getElementById('invite-status');
  if (!dialog || !openBtn || !form || !statusEl) return;

  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const open = () => {
    statusEl.textContent = '';
    statusEl.classList.remove('error');
    if (submitBtn) submitBtn.disabled = false;
    dialog.showModal();
  };

  const close = () => dialog.close();

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    statusEl.textContent = 'Enviando…';
    statusEl.classList.remove('error');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch('/invite-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(fd.get('name') || ''),
          email: String(fd.get('email') || ''),
          instagram: String(fd.get('instagram') || ''),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      if (!res.ok) {
        const raw = data.message;
        throw new Error(
          Array.isArray(raw) ? raw[0] : raw || `Erro ${res.status}`,
        );
      }
      form.reset();
      statusEl.textContent =
        'Pedido enviado. Se fizer sentido, a gente entra em contato.';
    } catch (error) {
      statusEl.textContent =
        error instanceof Error ? error.message : 'Não foi possível enviar';
      statusEl.classList.add('error');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

initInviteRequest();
