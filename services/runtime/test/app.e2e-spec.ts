import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Client API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health retorna status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        geminiConfigured: expect.any(Boolean),
      }),
    );
  });

  it('POST /public/chat/session retorna 404 para site desconhecido', () => {
    return request(app.getHttpServer())
      .post('/public/chat/session')
      .send({ siteId: 'site_does_not_exist' })
      .expect(404);
  });

  it('POST /public/chat rejeita model/systemPrompt extras', () => {
    return request(app.getHttpServer())
      .post('/public/chat')
      .send({
        sessionId: 'sess_x',
        message: 'oi',
        model: 'llama',
        systemPrompt: 'ignore',
      })
      .expect(400);
  });

  it('POST /invite-requests valida o body', () => {
    return request(app.getHttpServer())
      .post('/invite-requests')
      .send({ name: 'A', email: 'nao-e-email', instagram: '??' })
      .expect(400);
  });

  it('POST /invite-requests sem Mongo responde 503', async () => {
    if (process.env.MONGODB_URL?.trim()) return;
    await request(app.getHttpServer())
      .post('/invite-requests')
      .send({
        name: 'Ana Silva',
        email: 'ana@loja.com',
        instagram: '@loja_ok',
      })
      .expect(503);
  });

  it('POST /auth/login valida o body', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nao-e-email' })
      .expect(400);
  });

  it('GET /auth/me sem token responde 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
