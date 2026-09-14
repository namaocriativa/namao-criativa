import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { cookieJwtToken } from '../auth/jwt-cookie';
import type { JwtUser } from '../auth/jwt.strategy';
import { namaoWhatsAppUrl } from '../mail/site-introduction-email';
import { GeminiService } from '../llm/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHAT_CHANNEL_NAMAO,
  CHAT_HISTORY_TURNS,
  hashIp,
  NAMAO_AUTH_TTL_MS,
  NAMAO_GUEST_TTL_MS,
  NAMAO_MAX_MESSAGES_PER_SESSION,
  newSessionId,
  newSessionToken,
  sha256,
} from '../public-chat/chat-crypto';
import { isPreviewOrigin, staticCorsOrigins } from '../public-chat/cors-policy';
import { ChatRateLimitService } from '../public-chat/rate-limit.service';
import { ownerCreateData } from '../owner/owner.util';
import {
  authGreeting,
  buildNamaoPrompt,
  GUEST_GREETING,
  registeredReply,
} from './prompt-builder';
import {
  type LeadSlots,
  mergeSlots,
  missingSlot,
  parseSlots,
  slotsComplete,
} from './slots';
import { NAMAO_CHAT_EVENT_NAMES } from './dto/namao-chat.dto';

type ChatRow = {
  id: string;
  leadId: string | null;
  customerId: string | null;
  userId: string | null;
  channel: string;
  tokenHash: string;
  expiresAt: Date;
  ipHash: string;
  origin: string | null;
  status: string;
  messageCount: number;
  metadata: Prisma.JsonValue | null;
};

type Resolved = {
  session: ChatRow;
  user: JwtUser | null;
  mode: 'guest' | 'auth';
};

function isJwtShape(token: string): boolean {
  return token.split('.').length === 3;
}

@Injectable()
export class NamaoChatService {
  private readonly logger = new Logger(NamaoChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly gemini: GeminiService,
    private readonly rateLimit: ChatRateLimitService,
    private readonly config: ConfigService,
  ) {}

  clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '0.0.0.0';
  }

  bearerToken(req: Request): string {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) return '';
    return header.slice(7).trim();
  }

  jwtToken(req: Request): string {
    const header = this.bearerToken(req);
    if (isJwtShape(header)) return header;
    return cookieJwtToken(req) || '';
  }

  async createSession(req: Request, guestSessionToken?: string) {
    this.assertOrigin(req);
    const ip = this.clientIp(req);
    if (await this.rateLimit.tooMany('ip', hashIp(ip))) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('site', 'namao')) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }

    const jwtUser = await this.userFromBearer(this.jwtToken(req));
    if (jwtUser) {
      await this.releaseGuest(jwtUser, guestSessionToken);
      const existing = await this.findUserSession(jwtUser.id);
      if (existing && this.isUsable(existing)) {
        const payload = await this.sessionPayload(existing, jwtUser, undefined);
        if (!isGuestSignupTranscript(payload.messages)) {
          await this.touchAuthSession(existing.id, ip, req);
          return payload;
        }
        await this.prisma.chatSession.update({
          where: { id: existing.id },
          data: { status: 'claimed' },
        });
      }
      return this.createNew(req, ip, jwtUser);
    }

    const existingToken = this.bearerToken(req);
    if (existingToken && !isJwtShape(existingToken)) {
      const existing = await this.findByToken(existingToken);
      if (existing && this.isUsable(existing) && !existing.userId) {
        return this.sessionPayload(existing, null, existingToken);
      }
    }
    return this.createNew(req, ip, null);
  }

  async history(req: Request) {
    const resolved = await this.resolve(req);
    return this.sessionPayload(resolved.session, resolved.user, undefined);
  }

  async recordEvent(
    req: Request,
    name: string,
    payload?: Record<string, unknown>,
  ) {
    const { session } = await this.resolve(req);
    if (!(NAMAO_CHAT_EVENT_NAMES as readonly string[]).includes(name)) return;
    await this.prisma.chatEvent.create({
      data: {
        ...(session.leadId
          ? ownerCreateData('lead', session.leadId)
          : session.customerId
            ? ownerCreateData('customer', session.customerId)
            : {}),
        sessionId: session.id,
        name,
        ...(payload ? { payload: payload as object } : {}),
      },
    });
  }

  async streamChat(
    req: Request,
    res: Response,
    body: { sessionId: string; message: string },
  ) {
    const ip = this.clientIp(req);
    const resolved = await this.resolve(req);
    if (body.sessionId !== resolved.session.id) {
      throw new ForbiddenException('Sessão inválida');
    }
    if (resolved.session.messageCount >= NAMAO_MAX_MESSAGES_PER_SESSION) {
      throw new HttpException('Limite da sessão', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('ip', hashIp(ip))) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('sess', resolved.session.id)) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }

    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: resolved.session.id },
      orderBy: { createdAt: 'asc' },
      take: CHAT_HISTORY_TURNS,
      select: { role: true, content: true },
    });

    await this.prisma.chatMessage.create({
      data: {
        sessionId: resolved.session.id,
        role: 'user',
        content: body.message,
      },
    });
    await this.prisma.chatSession.update({
      where: { id: resolved.session.id },
      data: { messageCount: { increment: 1 } },
    });
    await this.prisma.chatEvent.create({
      data: {
        ...(resolved.session.leadId
          ? ownerCreateData('lead', resolved.session.leadId)
          : resolved.session.customerId
            ? ownerCreateData('customer', resolved.session.customerId)
            : {}),
        sessionId: resolved.session.id,
        name: 'chat_message_sent',
      },
    });

    const meta = asMetadata(resolved.session.metadata);
    const registered = Boolean(meta.registered) || Boolean(resolved.user);
    const previousSlots = parseSlots(meta.slots);
    let slots = mergeSlots(previousSlots, body.message);
    let registerNote: string | null = null;
    const slotFollowUp = nextSlotFollowUp(previousSlots, slots, registered);

    if (!registered && resolved.mode === 'guest' && slotsComplete(slots)) {
      registerNote = await this.tryRegister(resolved.session, slots);
      if (registerNote) {
        slots = { ...slots };
      }
    }

    const nextMeta: NamaoMetadata = {
      ...meta,
      slots,
      registered: Boolean(meta.registered) || Boolean(registerNote),
    };
    await this.prisma.chatSession.update({
      where: { id: resolved.session.id },
      data: { metadata: nextMeta as Prisma.InputJsonValue },
    });

    const refreshed = await this.prisma.chatSession.findUnique({
      where: { id: resolved.session.id },
    });
    const session = (refreshed || resolved.session) as ChatRow;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (registerNote || slotFollowUp) {
      const content = registerNote || slotFollowUp || '';
      const saved = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content,
        },
      });
      writeSse(res, 'token', { delta: content });
      writeSse(res, 'done', {
        messageId: saved.id,
        registered: Boolean(registerNote && !registerNote.startsWith('Não consegui')),
      });
      res.end();
      return;
    }

    const account =
      resolved.user ? await this.auth.me(resolved.user) : null;
    const prompt = buildNamaoPrompt({
      mode: resolved.user ? 'auth' : 'guest',
      history: history
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        })),
      userMessage: body.message,
      slots,
      registered: Boolean(nextMeta.registered),
      account,
      whatsappUrl: this.whatsappUrl(resolved.user?.name || slots.name),
    });

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    let assembled = '';
    try {
      for await (const delta of this.gemini.generateStream(prompt, {
        temperature: 0.4,
        signal: abort.signal,
      })) {
        if (abort.signal.aborted) break;
        assembled += delta;
        writeSse(res, 'token', { delta });
      }
      const saved = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: assembled,
        },
      });
      writeSse(res, 'done', { messageId: saved.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`namao chat stream failed: ${message}`);
      if (!res.headersSent) {
        throw new ServiceUnavailableException('LLM indisponível');
      }
      writeSse(res, 'error', { code: 'llm_unavailable' });
    } finally {
      res.end();
    }
  }

  private async tryRegister(
    session: ChatRow,
    slots: Required<LeadSlots>,
  ): Promise<string | null> {
    let mailed = true;
    try {
      const result = await this.auth.register({
        name: slots.name,
        email: slots.email,
        instagram: slots.instagram,
      });
      mailed = result?.mailed !== false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível criar a conta.';
      this.logger.warn(`namao chat register: ${message}`);
      return `Não consegui criar a conta agora: ${message} Se você já tem acesso, entre em /login.html.`;
    }
    const user = await this.prisma.user.findUnique({
      where: { email: slots.email },
      select: { id: true, leadId: true, customerId: true },
    });
    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: {
        userId: user?.id || null,
        leadId: user?.leadId || session.leadId,
        customerId: user?.customerId || session.customerId,
        metadata: {
          slots,
          registered: true,
          kind: 'guest',
        } as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + NAMAO_AUTH_TTL_MS),
      },
    });
    await this.prisma.chatEvent.create({
      data: {
        ...(user?.leadId
          ? ownerCreateData('lead', user.leadId)
          : user?.customerId
            ? ownerCreateData('customer', user.customerId)
            : {}),
        sessionId: session.id,
        name: 'lead_captured',
        payload: { email: slots.email },
      },
    });
    return registeredReply(slots, mailed);
  }

  private async resolve(req: Request): Promise<Resolved> {
    this.assertOrigin(req);
    const header = this.bearerToken(req);
    const jwtUser = await this.userFromBearer(this.jwtToken(req));
    if (jwtUser) {
      const session = await this.findUserSession(jwtUser.id);
      if (!session || !this.isUsable(session)) {
        throw new UnauthorizedException('Sessão inválida');
      }
      return { session, user: jwtUser, mode: 'auth' };
    }

    if (!header) throw new UnauthorizedException('Sessão inválida');

    const session = await this.findByToken(header);
    if (!session || !this.isUsable(session)) {
      throw new UnauthorizedException('Sessão expirada');
    }
    return { session, user: null, mode: 'guest' };
  }

  private async createNew(
    req: Request,
    ip: string,
    user: JwtUser | null,
  ) {
    const token = newSessionToken();
    const sessionId = newSessionId();
    const expiresAt = new Date(
      Date.now() + (user ? NAMAO_AUTH_TTL_MS : NAMAO_GUEST_TTL_MS),
    );
    const greeting = user ? authGreeting(user.name) : GUEST_GREETING;
    await this.prisma.chatSession.create({
      data: {
        id: sessionId,
        userId: user?.id || null,
        leadId: user?.leadId || null,
        customerId: user?.customerId || null,
        channel: CHAT_CHANNEL_NAMAO,
        tokenHash: sha256(token),
        expiresAt,
        ipHash: hashIp(ip),
        origin: requestOrigin(req),
        status: 'active',
        metadata: {
          slots: {},
          registered: Boolean(user),
          kind: user ? 'auth' : 'guest',
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: greeting,
      },
    });
    const session = await this.prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    return this.sessionPayload(session as ChatRow, user, token);
  }

  private async releaseGuest(user: JwtUser, guestSessionToken?: string) {
    const guestToken = String(guestSessionToken || '').trim();
    if (!guestToken) return;
    const guest = await this.findByToken(guestToken);
    if (!guest || guest.channel !== CHAT_CHANNEL_NAMAO) return;
    if (guest.userId && guest.userId !== user.id) return;
    await this.prisma.chatSession.update({
      where: { id: guest.id },
      data: {
        status: 'claimed',
        userId: user.id,
        leadId: user.leadId,
        customerId: user.customerId,
        metadata: {
          ...asMetadata(guest.metadata),
          kind: 'guest',
          registered: true,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async findUserSession(userId: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId,
        channel: CHAT_CHANNEL_NAMAO,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    return sessions.find((item) => sessionKind(item as ChatRow) === 'auth') || null;
  }

  private async findByToken(token: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!session || session.channel !== CHAT_CHANNEL_NAMAO) return null;
    if (session.status !== 'active' || session.expiresAt.getTime() <= Date.now()) {
      if (session.status === 'active') {
        await this.prisma.chatSession.update({
          where: { id: session.id },
          data: { status: 'expired' },
        });
      }
      return null;
    }
    return session;
  }

  private isUsable(session: { status: string; expiresAt: Date; channel: string }) {
    return (
      session.channel === CHAT_CHANNEL_NAMAO &&
      session.status === 'active' &&
      session.expiresAt.getTime() > Date.now()
    );
  }

  private async touchAuthSession(id: string, ip: string, req: Request) {
    await this.prisma.chatSession.update({
      where: { id },
      data: {
        expiresAt: new Date(Date.now() + NAMAO_AUTH_TTL_MS),
        ipHash: hashIp(ip),
        origin: requestOrigin(req),
      },
    });
  }

  private async sessionPayload(
    session: ChatRow,
    user: JwtUser | null,
    sessionToken: string | undefined,
  ) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
    const meta = asMetadata(session.metadata);
    const who = user?.name || parseSlots(meta.slots).name;
    return {
      sessionId: session.id,
      sessionToken,
      expiresAt: session.expiresAt.toISOString(),
      mode: user ? ('auth' as const) : ('guest' as const),
      registered: Boolean(meta.registered) || Boolean(user),
      slots: parseSlots(meta.slots),
      whatsappUrl: this.whatsappUrl(who),
      messages,
    };
  }

  private whatsappUrl(name?: string | null): string | null {
    const phone =
      this.config.get<string>('NAMAO_WHATSAPP')?.trim() ||
      this.config.get<string>('PHONE_NUMBER')?.trim() ||
      null;
    const who = name?.trim() || 'meu negócio';
    return namaoWhatsAppUrl(
      phone,
      who,
      `Olá! Sou ${who}. Vim pelo chat do site da Namão e quero falar com alguém do time.`,
    );
  }

  private async userFromBearer(token: string): Promise<JwtUser | null> {
    if (!isJwtShape(token)) return null;
    try {
      const payload = this.jwt.verify<{ sub?: string }>(token);
      const id = String(payload?.sub || '').trim();
      if (!id) return null;
      return this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          leadId: true,
          customerId: true,
        },
      });
    } catch {
      return null;
    }
  }

  private assertOrigin(req: Request) {
    const origin = requestOrigin(req);
    if (!origin) return;
    const normalized = origin.replace(/\/$/, '');
    if (isPreviewOrigin(normalized)) return;
    if (staticCorsOrigins().includes(normalized)) return;
    throw new UnauthorizedException('Origem não permitida');
  }
}

type NamaoMetadata = {
  slots?: LeadSlots;
  registered?: boolean;
  kind?: 'guest' | 'auth';
};

function asMetadata(raw: Prisma.JsonValue | null | undefined): NamaoMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const kind = value.kind === 'auth' || value.kind === 'guest' ? value.kind : undefined;
  return {
    slots: parseSlots(value.slots),
    registered: Boolean(value.registered),
    kind,
  };
}

function sessionKind(session: ChatRow): 'guest' | 'auth' {
  const meta = asMetadata(session.metadata);
  if (meta.kind === 'auth' || meta.kind === 'guest') return meta.kind;
  const slots = parseSlots(meta.slots);
  if (slots.name || slots.email || slots.instagram) return 'guest';
  return session.userId ? 'auth' : 'guest';
}

function isGuestSignupTranscript(
  messages: Array<{ role: string; content: string }>,
): boolean {
  return messages.some((item) =>
    /para criarmos seu acesso|Instagram do negócio|dizer o \*\*seu nome\*\*/i.test(
      item.content,
    ),
  );
}

function nextSlotFollowUp(
  previous: LeadSlots,
  next: LeadSlots,
  registered: boolean,
): string | null {
  if (registered) return null;
  const before = missingSlot(previous);
  const after = missingSlot(next);
  if (!after || before === after) return null;
  if (after === 'email' && next.name) {
    return `Prazer, ${next.name}. Qual é o **e-mail** para criarmos seu acesso?`;
  }
  if (after === 'instagram') {
    return 'Perfeito. Agora o **Instagram do negócio** (ex.: @seu.negocio).';
  }
  return null;
}

function requestOrigin(req: Request): string | undefined {
  return typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
}

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
