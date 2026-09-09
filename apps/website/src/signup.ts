import { api } from './session';

export const SIGNUP_SUCCESS =
  'Enviamos sua senha e o link de acesso para o e-mail.';

export const SIGNUP_MAIL_FAILED =
  'Conta criada, mas o e-mail com a senha não saiu. Fale no WhatsApp para receber o acesso.';

export async function createCustomerAccount(input: {
  name: string;
  email: string;
  instagram: string;
  inviteToken?: string;
}): Promise<{ mailed: boolean }> {
  const inviteToken = input.inviteToken?.trim();
  const data = (await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      instagram: input.instagram,
      ...(inviteToken ? { inviteToken } : {}),
    }),
  })) as { mailed?: boolean };
  return { mailed: data.mailed !== false };
}
