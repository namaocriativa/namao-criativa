import { ExecutionContext } from '@nestjs/common';
import { CookieOriginGuard } from './cookie-origin.guard';
import { CLIENT_TOKEN_COOKIE } from './roles';

function mockContext(req: {
  method: string;
  headers: Record<string, string>;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('CookieOriginGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const guard = new CookieOriginGuard(config as never, reflector as never);

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue(undefined);
  });

  it('não bloqueia login público quando há cookie do website', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(
      guard.canActivate(
        mockContext({
          method: 'POST',
          headers: {
            origin: 'http://localhost:5173',
            cookie: `${CLIENT_TOKEN_COOKIE}=leftover-client-token`,
          },
        }),
      ),
    ).toBe(true);
  });

  it('em rota protegida rejeita cookie do studio vindo do website', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    config.get.mockImplementation((key: string) =>
      key === 'NAMAO_STUDIO_URL'
        ? 'https://studio.namaocriativa.com.br'
        : 'https://namaocriativa.com.br',
    );
    expect(() =>
      guard.canActivate(
        mockContext({
          method: 'GET',
          headers: {
            origin: 'https://namaocriativa.com.br',
            cookie: 'namao_studio_token=studio-token',
          },
        }),
      ),
    ).toThrow(/Origem não permitida/);
  });
});
