import './chrome';
import { bindPixCopy, pixBlockHtml, type PixBlock } from './pix-block';
import { api, clearSession, probeLoggedIn } from './session';

type ProposalPackage = {
  name: string;
  summary?: string | null;
  description?: string | null;
  benefits?: string[];
  priceLine?: string;
};

type ProposalView = {
  status: 'pending' | 'accepted';
  paymentStatus: 'pending' | 'paid' | 'waived';
  package: ProposalPackage;
  legal: { name: string; cnpj: string | null };
  nextSteps: string[];
  pix: PixBlock | null;
};

type ProposalResponse = { proposal: ProposalView | null };

const kicker = document.getElementById('proposal-kicker') as HTMLElement;
const title = document.getElementById('proposal-title') as HTMLElement;
const lede = document.getElementById('proposal-lede') as HTMLElement;
const statusEl = document.getElementById('proposal-status') as HTMLElement;
const packageEl = document.getElementById('proposal-package') as HTMLElement;
const packageName = document.getElementById('proposal-package-name') as HTMLElement;
const priceEl = document.getElementById('proposal-price') as HTMLElement;
const summaryEl = document.getElementById('proposal-summary') as HTMLElement;
const descriptionEl = document.getElementById('proposal-description') as HTMLElement;
const benefitsEl = document.getElementById('proposal-benefits') as HTMLElement;
const stepsEl = document.getElementById('proposal-steps') as HTMLElement;
const stepsList = document.getElementById('proposal-steps-list') as HTMLElement;
const legalEl = document.getElementById('proposal-legal') as HTMLElement;
const legalCopy = document.getElementById('proposal-legal-copy') as HTMLElement;
const acceptRow = document.getElementById('proposal-accept-row') as HTMLElement;
const terms = document.getElementById('proposal-terms') as HTMLInputElement;
const acceptBtn = document.getElementById('proposal-accept') as HTMLButtonElement;
const dashLink = document.getElementById('proposal-dashboard-link') as HTMLAnchorElement;
const pixEl = document.getElementById('proposal-pix') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatus(message: string, error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', error);
}

function renderPix(pix: PixBlock | null) {
  if (!pix) {
    pixEl.hidden = true;
    pixEl.innerHTML = '';
    return;
  }
  pixEl.hidden = false;
  pixEl.innerHTML = pixBlockHtml(pix);
  bindPixCopy(pixEl);
}

function renderProposal(proposal: ProposalView) {
  const accepted = proposal.status === 'accepted';
  kicker.textContent = accepted ? 'Proposta aceita' : 'Proposta';
  title.textContent = proposal.package.name;
  lede.textContent = accepted
    ? 'Você já é cliente. Confira o pagamento pendente, se houver, e siga para o painel.'
    : 'Revise o pacote, os próximos passos e os termos antes de continuar.';
  packageEl.hidden = false;
  packageName.textContent = proposal.package.name;
  priceEl.textContent = proposal.package.priceLine || '';
  summaryEl.textContent = proposal.package.summary || '';
  descriptionEl.textContent = proposal.package.description || '';
  benefitsEl.innerHTML = (proposal.package.benefits || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  stepsEl.hidden = false;
  stepsList.innerHTML = proposal.nextSteps
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  legalEl.hidden = false;
  const cnpj = proposal.legal.cnpj
    ? `CNPJ ${proposal.legal.cnpj}`
    : 'CNPJ será informado pela Namão';
  legalCopy.textContent = `${proposal.legal.name} · ${cnpj}`;
  acceptRow.hidden = accepted;
  acceptBtn.hidden = accepted;
  dashLink.hidden = !accepted;
  renderPix(proposal.pix);
}

async function load() {
  const data = (await api('/proposal')) as ProposalResponse;
  if (!data.proposal) {
    lede.textContent =
      'Ainda não há uma proposta para esta conta. Quando a Namão enviar, ela aparece aqui.';
    dashLink.hidden = false;
    return;
  }
  renderProposal(data.proposal);
}

void (async () => {
  if (!(await probeLoggedIn())) {
    location.href = '/login.html?next=/proposta.html';
    return;
  }
  try {
    await load();
  } catch (error) {
    if (error instanceof Error && /401|403/.test(error.message)) {
      await clearSession();
      location.href = '/login.html?next=/proposta.html';
      return;
    }
    setStatus(
      error instanceof Error ? error.message : 'Não foi possível carregar a proposta.',
      true,
    );
  }
})();

terms.addEventListener('change', () => {
  acceptBtn.disabled = !terms.checked;
});

acceptBtn.addEventListener('click', () => {
  if (!terms.checked || acceptBtn.disabled) return;
  void (async () => {
    acceptBtn.disabled = true;
    setStatus('Confirmando…');
    try {
      const data = (await api('/proposal/accept', { method: 'POST' })) as ProposalResponse;
      if (data.proposal) renderProposal(data.proposal);
      setStatus('Proposta aceita. Você já é cliente.');
      location.href = '/dashboard.html';
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Não foi possível aceitar a proposta.',
        true,
      );
      acceptBtn.disabled = !terms.checked;
    }
  })();
});

logoutBtn.addEventListener('click', () => {
  void (async () => {
    await clearSession();
    location.href = '/login.html';
  })();
});
