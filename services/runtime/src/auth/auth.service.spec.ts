import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lead: { findUnique: jest.fn() },
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const service = new AuthService(prisma as never, jwt as never);

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.sign.mockReturnValue('token');
  });

  it('rejeita e-mail inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@b.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('devolve lead no me', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
    });
    const result = await service.me({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: 'CLIENT',
      leadId: 'lead-1',
    });
    expect(result.lead?.id).toBe('lead-1');
  });
});
