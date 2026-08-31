import {
  ForbiddenException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { PublicChatMessageDto } from './dto/public-chat.dto';
import { PublicChatService } from './public-chat.service';

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

function session(leadId = 'lead-a') {
  return {
    id: 'sess_a',
    leadId,
    messageCount: 0,
    lead: {
      chatEnabled: true,
      publicSiteId: 'site_a',
      publishedOrigin: null,
    },
  };
}

describe('PublicChatService', () => {
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
        { type: 'body', metatype: PublicChatMessageDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('responde 429 quando o IP estoura', async () => {
    const service = new PublicChatService(
      { create: jest.fn() } as never,
      { tooMany: jest.fn().mockResolvedValue(true) } as never,
      { build: jest.fn() } as never,
      { generateStream: jest.fn() } as never,
      {} as never,
    );
    await expect(
      service.createSession(
        { headers: {}, ip: '9.9.9.9', socket: {} } as never,
        'site_a',
      ),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('não usa contexto de outro lead', async () => {
    const build = jest.fn().mockResolvedValue({
      leadId: 'lead-a',
      trusted: { name: 'Alfa' },
      lp: { titles: [], faq: [], features: [] },
      untrusted: '',
    });
    const service = new PublicChatService(
      {
        resolve: jest.fn().mockResolvedValue(session('lead-a')),
      } as never,
      { tooMany: jest.fn().mockResolvedValue(false) } as never,
      { build } as never,
      {
        generateStream: async function* () {
          yield 'Oi';
        },
      } as never,
      {
        chatMessage: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'm1' }),
        },
        chatSession: { update: jest.fn() },
        chatEvent: { create: jest.fn() },
      } as never,
    );
    const { res } = mockRes();
    await service.streamChat(
      { headers: {}, ip: '127.0.0.1', socket: {}, on: jest.fn() } as never,
      res as never,
      { sessionId: 'sess_a', message: 'Oi' },
    );
    expect(build).toHaveBeenCalledWith('lead-a');
    expect(build).not.toHaveBeenCalledWith('lead-b');
  });

  it('rejeita sessionId diferente da sessão autenticada', async () => {
    const service = new PublicChatService(
      {
        resolve: jest.fn().mockResolvedValue(session('lead-a')),
      } as never,
      { tooMany: jest.fn() } as never,
      { build: jest.fn() } as never,
      { generateStream: jest.fn() } as never,
      {} as never,
    );
    await expect(
      service.streamChat(
        { headers: {}, ip: '127.0.0.1', socket: {}, on: jest.fn() } as never,
        mockRes().res as never,
        { sessionId: 'sess_b', message: 'Oi' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('envia chunks SSE antes do done', async () => {
    const service = new PublicChatService(
      {
        resolve: jest.fn().mockResolvedValue(session()),
      } as never,
      { tooMany: jest.fn().mockResolvedValue(false) } as never,
      {
        build: jest.fn().mockResolvedValue({
          leadId: 'lead-a',
          trusted: { name: 'Alfa' },
          lp: { titles: [], faq: [], features: [] },
          untrusted: '',
        }),
      } as never,
      {
        generateStream: async function* () {
          yield 'Olá';
          yield ' mundo';
        },
      } as never,
      {
        chatMessage: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        },
        chatSession: { update: jest.fn() },
        chatEvent: { create: jest.fn() },
      } as never,
    );
    const { res, chunks } = mockRes();
    await service.streamChat(
      { headers: {}, ip: '127.0.0.1', socket: {}, on: jest.fn() } as never,
      res as never,
      { sessionId: 'sess_a', message: 'Oi' },
    );
    const body = chunks.join('');
    expect(body.indexOf('event: token')).toBeGreaterThanOrEqual(0);
    expect(body.indexOf('event: token')).toBeLessThan(
      body.indexOf('event: done'),
    );
    expect(body).toContain('"delta":"Olá"');
    expect(body).toContain('msg-1');
  });

  it('emite error quando o Gemini falha depois dos headers', async () => {
    const service = new PublicChatService(
      {
        resolve: jest.fn().mockResolvedValue(session()),
      } as never,
      { tooMany: jest.fn().mockResolvedValue(false) } as never,
      {
        build: jest.fn().mockResolvedValue({
          leadId: 'lead-a',
          trusted: { name: 'Alfa' },
          lp: { titles: [], faq: [], features: [] },
          untrusted: '',
        }),
      } as never,
      {
        generateStream: async function* () {
          throw new Error('gemini down');
          yield '';
        },
      } as never,
      {
        chatMessage: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'm1' }),
        },
        chatSession: { update: jest.fn() },
        chatEvent: { create: jest.fn() },
      } as never,
    );
    const { res, chunks } = mockRes();
    await service.streamChat(
      { headers: {}, ip: '127.0.0.1', socket: {}, on: jest.fn() } as never,
      res as never,
      { sessionId: 'sess_a', message: 'Oi' },
    );
    expect(chunks.join('')).toContain('event: error');
    expect(chunks.join('')).toContain('llm_unavailable');
  });
});
