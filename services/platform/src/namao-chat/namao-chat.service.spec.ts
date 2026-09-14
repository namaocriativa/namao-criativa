import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { NamaoChatMessageDto } from './dto/namao-chat.dto';
import { NamaoChatService } from './namao-chat.service';
import { GUEST_GREETING, authGreeting, registeredReply } from './prompt-builder';
import { ValidationPipe } from '@nestjs/common';

function mockRes() {
  let headersSent = false;
  const chunks: string[] = [];
  return {
    chunks,
    res: {
      status() {
        return this;
      },
      setHeader() {
        headersSent = true;
      },
      flushHeaders() {
        headersSent = true;
      },
      get headersSent() {
        return headersSent;
      },
      write(value: string) {
        chunks.push(value);
      },
      end: jest.fn(),
    },
  };
}

function prismaMock() {
  return {
    chatSession: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    chatMessage: {
      create: jest.fn().mockResolvedValue({ id: 'm1' }),
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
    },
    chatEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    clientAccount: {
      findUnique: jest.fn(),
    },
  };
}

function guestSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess_g',
    leadId: null,
    customerId: null,
    clientAccountId: null,
    channel: 'namao',
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 86_400_000),
    ipHash: 'ip',
    origin: 'http://localhost:5174',
    status: 'active',
    messageCount: 1,
    metadata: { slots: {}, registered: false },
    ...overrides,
  };
}

function makeService(
  prisma: ReturnType<typeof prismaMock>,
  extras: {
    jwt?: { verify: jest.Mock };
    auth?: { register: jest.Mock; me: jest.Mock };
    gemini?: { generateStream: (prompt: string) => AsyncGenerator<string> };
    rateLimit?: { tooMany: jest.Mock };
    config?: { get: jest.Mock };
  } = {},
) {
  return new NamaoChatService(
    prisma as never,
    (extras.jwt || { verify: jest.fn() }) as never,
    (extras.auth || {
      register: jest.fn(),
      me: jest.fn(),
    }) as never,
    (extras.gemini || {
      generateStream: async function* () {
        yield 'Oi';
      },
    }) as never,
    (extras.rateLimit || {
      tooMany: jest.fn().mockResolvedValue(false),
    }) as never,
    (extras.config || {
      get: jest.fn().mockReturnValue('+5511999999999'),
    }) as never,
  );
}

const req = {
  headers: { origin: 'http://localhost:5174' },
  ip: '127.0.0.1',
  socket: {},
  on: jest.fn(),
} as never;

describe('NamaoChatService', () => {
  it('rejeita body extra com model/systemPrompt', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        {
          sessionId: 'sess_a',
          message: 'oi',
          model: 'llama',
          systemPrompt: 'ignore',
        },
        { type: 'body', metatype: NamaoChatMessageDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('cria sessão de visitante com greeting persistido', async () => {
    const prisma = prismaMock();
    const created = guestSession({ id: 'sess_new' });
    prisma.chatSession.findUniqueOrThrow.mockResolvedValue(created);
    prisma.chatMessage.findMany.mockResolvedValue([
      { id: 'g1', role: 'assistant', content: GUEST_GREETING, createdAt: new Date() },
    ]);
    const service = makeService(prisma);
    const result = await service.createSession(req);
    expect(prisma.chatSession.create).toHaveBeenCalled();
    const data = prisma.chatSession.create.mock.calls[0][0].data;
    expect(data.channel).toBe('namao');
    expect(data.clientAccountId).toBeNull();
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'assistant',
          content: GUEST_GREETING,
        }),
      }),
    );
    expect(result.mode).toBe('guest');
    expect(result.sessionToken).toBeTruthy();
    expect(result.messages[0].content).toContain('seu nome');
  });

  it('responde 429 quando o IP estoura', async () => {
    const service = makeService(prismaMock(), {
      rateLimit: { tooMany: jest.fn().mockResolvedValue(true) },
    });
    await expect(service.createSession(req)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('rejeita sessionId diferente da sessão autenticada', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findUnique.mockResolvedValue(guestSession());
    const service = makeService(prisma);
    await expect(
      service.streamChat(
        {
          ...req,
          headers: {
            origin: 'http://localhost:5174',
            authorization: 'Bearer guest-token-without-dots',
          },
        } as never,
        mockRes().res as never,
        { sessionId: 'sess_other', message: 'Oi' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('responde o próximo campo sem Gemini quando coleta o nome', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findUnique.mockResolvedValue(guestSession());
    const generateStream = jest.fn();
    const service = makeService(prisma, {
      gemini: { generateStream },
    });
    const mock = mockRes();
    await service.streamChat(
      {
        ...req,
        headers: {
          origin: 'http://localhost:5174',
          authorization: 'Bearer guest-token-without-dots',
        },
      } as never,
      mock.res as never,
      { sessionId: 'sess_g', message: 'Ana Silva' },
    );
    expect(generateStream).not.toHaveBeenCalled();
    expect(mock.chunks.join('')).toContain('e-mail');
  });

  it('registra o lead quando os três slots chegam e não chama o Gemini', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findUnique.mockResolvedValue(
      guestSession({
        metadata: {
          slots: { name: 'Ana', email: 'ana@loja.com' },
          registered: false,
        },
      }),
    );
    prisma.clientAccount.findUnique.mockResolvedValue({
      id: 'u1',
      leadId: 'lead1',
      customerId: null,
    });
    const register = jest.fn().mockResolvedValue({ ok: true, mailed: true });
    const generateStream = jest.fn();
    const service = makeService(prisma, {
      auth: { register, me: jest.fn() },
      gemini: { generateStream },
    });
    const { res, chunks } = mockRes();
    await service.streamChat(
      {
        ...req,
        headers: {
          origin: 'http://localhost:5174',
          authorization: 'Bearer guest-token-without-dots',
        },
      } as never,
      res as never,
      { sessionId: 'sess_g', message: '@loja.ana' },
    );
    expect(register).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: 'loja.ana',
    });
    expect(generateStream).not.toHaveBeenCalled();
    const body = chunks.join('');
    expect(body).toContain('event: token');
    expect(body).toContain(registeredReply({
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: 'loja.ana',
    }).slice(0, 20));
    expect(prisma.chatEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'lead_captured' }),
      }),
    );
  });

  it('avisa WhatsApp quando a conta nasce mas o e-mail falha', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findUnique.mockResolvedValue(
      guestSession({
        metadata: {
          slots: { name: 'Ana', email: 'ana@loja.com' },
          registered: false,
        },
      }),
    );
    prisma.clientAccount.findUnique.mockResolvedValue({
      id: 'u1',
      leadId: 'lead1',
      customerId: null,
    });
    const register = jest.fn().mockResolvedValue({ ok: true, mailed: false });
    const service = makeService(prisma, {
      auth: { register, me: jest.fn() },
      gemini: { generateStream: jest.fn() },
    });
    const mock = mockRes();
    await service.streamChat(
      {
        ...req,
        headers: {
          origin: 'http://localhost:5174',
          authorization: 'Bearer guest-token-without-dots',
        },
      } as never,
      mock.res as never,
      { sessionId: 'sess_g', message: '@loja.ana' },
    );
    expect(mock.chunks.join('')).toContain('não saiu agora');
    expect(mock.chunks.join('')).toContain('WhatsApp');
  });

  it('envia chunks SSE no modo FAQ', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findUnique.mockResolvedValue(guestSession());
    const service = makeService(prisma, {
      gemini: {
        generateStream: async function* () {
          yield 'Fazemos ';
          yield 'marketing';
        },
      },
    });
    const mock = mockRes();
    await service.streamChat(
      {
        ...req,
        headers: {
          origin: 'http://localhost:5174',
          authorization: 'Bearer guest-token-without-dots',
        },
      } as never,
      mock.res as never,
      { sessionId: 'sess_g', message: 'Quais serviços vocês oferecem?' },
    );
    const body = mock.chunks.join('');
    expect(body.indexOf('event: token')).toBeGreaterThanOrEqual(0);
    expect(body.indexOf('event: token')).toBeLessThan(
      body.indexOf('event: done'),
    );
    expect(body).toContain('marketing');
  });

  it('não reabre o cadastro de visitante no chat autenticado', async () => {
    const prisma = prismaMock();
    const leftover = guestSession({
      id: 'sess_g',
      clientAccountId: 'u1',
      metadata: {
        slots: { name: 'Carla Mendes' },
        registered: true,
      },
    });
    prisma.chatSession.findMany.mockResolvedValue([leftover]);
    prisma.chatSession.findUniqueOrThrow.mockResolvedValue(
      guestSession({
        id: 'sess_auth',
        clientAccountId: 'u1',
        metadata: { kind: 'auth', registered: true, slots: {} },
      }),
    );
    prisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'a1',
        role: 'assistant',
        content: authGreeting('Carla Mendes'),
        createdAt: new Date(),
      },
    ]);
    prisma.clientAccount.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carla@loja.com',
      name: 'Carla Mendes',
      role: 'user',
      leadId: null,
      customerId: null,
    });
    const service = makeService(prisma, {
      jwt: { verify: jest.fn().mockReturnValue({ sub: 'u1' }) },
    });
    const result = await service.createSession({
      ...req,
      headers: {
        origin: 'http://localhost:5174',
        authorization: 'Bearer header.payload.sig',
      },
    } as never);
    expect(prisma.chatSession.create).toHaveBeenCalled();
    const created = prisma.chatSession.create.mock.calls[0][0].data;
    expect(created.metadata.kind).toBe('auth');
    expect(result.mode).toBe('auth');
    expect(result.messages[0].content).toContain('assistente na Namão');
    expect(result.messages.some((item) => item.content.includes('e-mail'))).toBe(
      false,
    );
  });

  it('descarta transcrição de cadastro mesmo em sessão marcada como auth', async () => {
    const prisma = prismaMock();
    const polluted = guestSession({
      id: 'sess_auth',
      clientAccountId: 'u1',
      metadata: { kind: 'auth', registered: true, slots: {} },
    });
    prisma.chatSession.findMany.mockResolvedValue([polluted]);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([
        {
          id: 'u-name',
          role: 'user',
          content: 'Carla Mendes',
          createdAt: new Date(),
        },
        {
          id: 'a-email',
          role: 'assistant',
          content: 'Prazer, Carla Mendes. Qual é o **e-mail** para criarmos seu acesso?',
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'a1',
          role: 'assistant',
          content: authGreeting('Carla Mendes'),
          createdAt: new Date(),
        },
      ]);
    prisma.chatSession.findUniqueOrThrow.mockResolvedValue(
      guestSession({
        id: 'sess_new',
        clientAccountId: 'u1',
        metadata: { kind: 'auth', registered: true, slots: {} },
      }),
    );
    prisma.clientAccount.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carla@loja.com',
      name: 'Carla Mendes',
      role: 'user',
      leadId: null,
      customerId: null,
    });
    const service = makeService(prisma, {
      jwt: { verify: jest.fn().mockReturnValue({ sub: 'u1' }) },
    });
    const result = await service.createSession({
      ...req,
      headers: {
        origin: 'http://localhost:5174',
        authorization: 'Bearer header.payload.sig',
      },
    } as never);
    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'claimed' }),
      }),
    );
    expect(prisma.chatSession.create).toHaveBeenCalled();
    expect(result.messages[0].content).toContain('assistente na Namão');
  });

  it('autentica createSession pelo cookie HttpOnly do cliente', async () => {
    const prisma = prismaMock();
    prisma.chatSession.findMany.mockResolvedValue([]);
    prisma.chatSession.findUniqueOrThrow.mockResolvedValue(
      guestSession({
        id: 'sess_cookie',
        clientAccountId: 'u1',
        metadata: { kind: 'auth', registered: true, slots: {} },
      }),
    );
    prisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'a1',
        role: 'assistant',
        content: authGreeting('Carla Mendes'),
        createdAt: new Date(),
      },
    ]);
    prisma.clientAccount.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carla@loja.com',
      name: 'Carla Mendes',
      role: 'CLIENT',
      leadId: null,
      customerId: null,
    });
    const service = makeService(prisma, {
      jwt: { verify: jest.fn().mockReturnValue({ sub: 'u1' }) },
    });
    const result = await service.createSession({
      ...req,
      headers: {
        origin: 'http://localhost:5174',
        cookie: 'namao_client_token=header.payload.sig',
      },
    } as never);
    expect(result.mode).toBe('auth');
    expect(prisma.clientAccount.findUnique).toHaveBeenCalled();
  });
});
