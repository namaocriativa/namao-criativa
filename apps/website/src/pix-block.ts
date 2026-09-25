export type PixBlock = {
  key: string;
  cnpj: string | null;
  merchantName: string;
  amount: number | null;
  amountLabel: string | null;
  brCode: string;
  qrDataUrl: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function pixBlockHtml(pix: PixBlock): string {
  const amount = pix.amountLabel || 'valor combinado';
  return `
    <p class="kicker">Pagamento PIX</p>
    <h2>Pagamento pendente</h2>
    <p>Use o QR ou copie o código PIX para pagar ${escapeHtml(amount)} para ${escapeHtml(pix.merchantName)}.</p>
    ${pix.cnpj ? `<p>CNPJ ${escapeHtml(pix.cnpj)}</p>` : ''}
    <img class="pix-qr" src="${escapeHtml(pix.qrDataUrl)}" alt="QR Code PIX" width="220" height="220" />
    <label class="pix-copy">
      <span>Copia e cola</span>
      <textarea readonly rows="4">${escapeHtml(pix.brCode)}</textarea>
    </label>
    <button type="button" class="btn btn-ghost" data-pix-copy>Copiar código PIX</button>
    <p class="pix-copy-status" data-pix-status hidden></p>
  `;
}

export function bindPixCopy(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>('[data-pix-copy]');
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
  const status = root.querySelector<HTMLElement>('[data-pix-status]');
  if (!button || !textarea) return;
  button.addEventListener('click', () => {
    void navigator.clipboard.writeText(textarea.value).then(
      () => {
        if (status) {
          status.hidden = false;
          status.textContent = 'Código copiado.';
        }
      },
      () => {
        textarea.select();
        if (status) {
          status.hidden = false;
          status.textContent = 'Selecione o código e copie manualmente.';
        }
      },
    );
  });
}
