import { OFFICIAL_PIX_QR_DATA_URL } from './official-pix-qr';
import {
  buildPixBrCode,
  buildPixPayload,
  crc16,
  formatPixAmount,
  isPixEmvPayload,
} from './pix';

describe('PIX BR Code', () => {
  it('calcula CRC16 do payload de exemplo do Banco Central', () => {
    const body =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(body)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('monta payload EMV com chave, valor e CRC', () => {
    const code = buildPixBrCode({
      key: '12345678000199',
      merchantName: 'Namão Criativa',
      city: 'Leme',
      amount: 800,
      txid: 'NAMAO',
    });
    expect(code).toContain('br.gov.bcb.pix');
    expect(code).toContain('12345678000199');
    expect(code).toContain('5303986');
    expect(code).toContain('5406800.00');
    expect(code.startsWith('000201')).toBe(true);
    expect(code.slice(-8).startsWith('6304')).toBe(true);
    const body = code.slice(0, -4);
    expect(crc16(body)).toBe(code.slice(-4));
  });

  it('ignora valor inválido', () => {
    expect(formatPixAmount(0)).toBeNull();
    expect(formatPixAmount(-1)).toBeNull();
    expect(formatPixAmount(10)).toBe('10.00');
  });

  it('reconhece payload EMV pronto e usa o QR estático', async () => {
    const emv =
      '00020101021126360014br.gov.bcb.pix0114458367530001705204000053039865802BR5911LEONE SOUZA6009SAO PAULO622905251M3ANA57A45AGS7BTJRRBVEQF63047C1C';
    expect(isPixEmvPayload(emv)).toBe(true);
    expect(isPixEmvPayload('45836753000170')).toBe(false);
    const payload = await buildPixPayload({
      key: emv,
      merchantName: 'LEONE DE SOUZA - ME',
      cnpj: '45.836.753/0001-70',
      amount: 800,
    });
    expect(payload.brCode).toBe(emv);
    expect(payload.qrDataUrl).toBe(OFFICIAL_PIX_QR_DATA_URL);
    expect(payload.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(payload.amountLabel).toContain('800');
  });
});
