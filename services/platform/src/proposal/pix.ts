import QRCode from 'qrcode';
import { OFFICIAL_PIX_QR_DATA_URL } from './official-pix-qr';

export const DEFAULT_PIX_MERCHANT = 'Namão Criativa';
export const DEFAULT_PIX_CITY = 'LEME';

export type PixInput = {
  key: string;
  merchantName?: string | null;
  city?: string | null;
  amount?: number | null;
  txid?: string | null;
};

export type PixPayload = {
  key: string;
  cnpj: string | null;
  merchantName: string;
  amount: number | null;
  amountLabel: string | null;
  brCode: string;
  qrDataUrl: string;
};

function tlv(id: string, value: string): string {
  const body = value.slice(0, 99);
  return `${id}${String(body.length).padStart(2, '0')}${body}`;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function asciiField(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export function isPixEmvPayload(value: string): boolean {
  const raw = value.trim();
  return raw.startsWith('000201') && raw.includes('br.gov.bcb.pix');
}

export function formatPixAmount(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2);
}

export function buildPixBrCode(input: PixInput): string {
  const key = input.key.trim();
  const name = asciiField(input.merchantName || DEFAULT_PIX_MERCHANT, 25) || 'NAMAO';
  const city = asciiField(input.city || DEFAULT_PIX_CITY, 15) || 'LEME';
  const amount = formatPixAmount(input.amount ?? null);
  const txid = asciiField(input.txid || 'NAMAO', 25) || 'NAMAO';
  const merchant = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  const extra = tlv('05', txid);
  let payload =
    tlv('00', '01') +
    tlv('26', merchant) +
    tlv('52', '0000') +
    tlv('53', '986');
  if (amount) payload += tlv('54', amount);
  payload += tlv('58', 'BR') + tlv('59', name) + tlv('60', city) + tlv('62', extra);
  payload += '6304';
  return payload + crc16(payload);
}

export async function buildPixPayload(
  input: PixInput & { cnpj?: string | null },
): Promise<PixPayload> {
  const raw = input.key.trim();
  const staticEmv = isPixEmvPayload(raw);
  const brCode = staticEmv ? raw : buildPixBrCode(input);
  const amount = formatPixAmount(input.amount ?? null);
  const amountNumber = amount ? Number(amount) : null;
  return {
    key: raw,
    cnpj: input.cnpj?.trim() || null,
    merchantName: (input.merchantName || DEFAULT_PIX_MERCHANT).trim(),
    amount: amountNumber,
    amountLabel:
      amountNumber != null
        ? new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(amountNumber)
        : null,
    brCode,
    qrDataUrl: staticEmv
      ? OFFICIAL_PIX_QR_DATA_URL
      : await QRCode.toDataURL(brCode, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 280,
          color: { dark: '#050505', light: '#ffffff' },
        }),
  };
}
