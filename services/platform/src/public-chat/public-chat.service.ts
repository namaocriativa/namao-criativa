import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GeminiService } from '../llm/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatContextBuilder } from './context-builder';
import { originAllowedForLead } from './cors-policy';
import { hashIp, MAX_MESSAGES_PER_SESSION } from './chat-crypto';
import { CHAT_EVENT_NAMES } from './dto/public-chat.dto';
import { buildChatPrompt } from './prompt-builder';
import { ChatRateLimitService } from './rate-limit.service';
import { ChatSessionService } from './session.service';
import { ownerCreateData } from '../owner/owner.util';

@Injectable()
export class PublicChatService {
  private readonly logger = new Logger(PublicChatService.name);

  constructor(
    private readonly sessions: ChatSessionService,
    private readonly rateLimit: ChatRateLimitService,
    private readonly contextBuilder: ChatContextBuilder,
    private readonly gemini: GeminiService,
    private readonly prisma: PrismaService,
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

  async createSession(req: Request, siteId: string) {
    const ip = this.clientIp(req);
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (await this.rateLimit.tooMany('ip', hashIp(ip))) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('site', siteId)) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.sessions.create({ siteId, ip, origin });
  }

  async recordEvent(
    req: Request,
    name: string,
    payload?: Record<string, unknown>,
  ) {
    const session = await this.sessions.resolve(this.bearerToken(req));
    this.assertOrigin(req, session.lead.publishedOrigin);
    if (!(CHAT_EVENT_NAMES as readonly string[]).includes(name)) return;
    await this.prisma.chatEvent.create({
      data: {
        ...ownerCreateData(session.customerId ? 'customer' : 'lead', session.leadId),
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
    const session = await this.sessions.resolve(this.bearerToken(req));
    this.assertOrigin(req, session.lead.publishedOrigin);
    if (body.sessionId !== session.id) {
      throw new ForbiddenException('Sessão inválida');
    }
    if (session.messageCount >= MAX_MESSAGES_PER_SESSION) {
      throw new HttpException('Limite da sessão', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('ip', hashIp(ip))) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.rateLimit.tooMany('sess', session.id)) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (
      session.lead.publicSiteId &&
      (await this.rateLimit.tooMany('site', session.lead.publicSiteId))
    ) {
      throw new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS);
    }

    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });
    const context = await this.contextBuilder.build(session.leadId);
    if (context.leadId !== session.leadId) {
      throw new ForbiddenException('Sessão inválida');
    }
    const prompt = buildChatPrompt({
      context,
      history: history
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        })),
      userMessage: body.message,
    });

    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: body.message,
      },
    });
    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: { messageCount: { increment: 1 } },
    });
    await this.prisma.chatEvent.create({
      data: {
        ...ownerCreateData(session.customerId ? 'customer' : 'lead', session.leadId),
        sessionId: session.id,
        name: 'chat_message_sent',
      },
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

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
      this.logger.warn(`chat stream failed: ${message}`);
      if (!res.headersSent) {
        throw new ServiceUnavailableException('LLM indisponível');
      }
      writeSse(res, 'error', { code: 'llm_unavailable' });
    } finally {
      res.end();
    }
  }

  private assertOrigin(req: Request, publishedOrigin?: string | null) {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (!originAllowedForLead(origin, publishedOrigin)) {
      throw new UnauthorizedException('Origem não permitida');
    }
  }
}

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
