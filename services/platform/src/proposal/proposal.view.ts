import type { ConfigService } from '@nestjs/config';
import { buildPixPayload, DEFAULT_PIX_MERCHANT, type PixPayload } from './pix';
import { parseSnapshot, presentSnapshot, snapshotAmount } from './proposal.snapshot';
import { PAYMENT_STATUS, PROPOSAL_STATUS } from './proposal.constants';

export type ProposalRowView = {
  id: string;
  status: string;
  paymentStatus: string;
  collectPayment: boolean;
  acceptedAt: Date | null;
  paidAt: Date | null;
  packageSnapshot: unknown;
};

export function legalFromConfig(config: ConfigService) {
  return {
    name: config.get<string>('NAMAO_LEGAL_NAME')?.trim() || DEFAULT_PIX_MERCHANT,
    cnpj: config.get<string>('NAMAO_CNPJ')?.trim() || null,
  };
}

export async function pixIfPending(
  row: ProposalRowView,
  config: ConfigService,
): Promise<PixPayload | null> {
  if (row.status !== PROPOSAL_STATUS.ACCEPTED) return null;
  if (row.paymentStatus !== PAYMENT_STATUS.PENDING) return null;
  if (!row.collectPayment) return null;
  const key = config.get<string>('NAMAO_PIX_KEY')?.trim();
  if (!key) return null;
  const snapshot = parseSnapshot(row.packageSnapshot);
  return buildPixPayload({
    key,
    cnpj: config.get<string>('NAMAO_CNPJ')?.trim() || null,
    merchantName:
      config.get<string>('NAMAO_LEGAL_NAME')?.trim() || DEFAULT_PIX_MERCHANT,
    amount: snapshotAmount(snapshot),
    txid: `P${row.id.replace(/[^a-z0-9]/gi, '').slice(0, 20)}`,
  });
}

export async function presentProposal(
  row: ProposalRowView,
  config: ConfigService,
) {
  const snapshot = parseSnapshot(row.packageSnapshot);
  return {
    status: row.status,
    paymentStatus: row.paymentStatus,
    collectPayment: row.collectPayment,
    acceptedAt: row.acceptedAt?.toISOString() || null,
    paidAt: row.paidAt?.toISOString() || null,
    package: presentSnapshot(snapshot),
    legal: legalFromConfig(config),
    nextSteps: [
      'Revise o pacote, o valor e o que está incluso.',
      'Leia os Termos de uso e aceite para se tornar cliente.',
      'Depois do aceite, o painel da Namão fica liberado.',
      'Se o pagamento estiver pendente, pague via PIX nesta página ou no painel.',
    ],
    termsUrl: '/termos.html',
    pix: await pixIfPending(row, config),
  };
}

export async function clientProposalSummary(
  row: ProposalRowView | null,
  config: ConfigService,
) {
  if (!row) {
    return { proposal: null, payment: null as PixPayload | null };
  }
  return {
    proposal: {
      status: row.status,
      paymentStatus: row.paymentStatus,
    },
    payment: await pixIfPending(row, config),
  };
}
