import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Discovery Lead Enrichment (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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

  it('POST /lead-discovery sem JWT responde 401', () => {
    return request(app.getHttpServer())
      .post('/lead-discovery')
      .send({})
      .expect(401);
  });

  it('POST /enrichment sem JWT responde 401', () => {
    return request(app.getHttpServer())
      .post('/enrichment')
      .send({})
      .expect(401);
  });

  it('GET /leads sem JWT responde 401', () => {
    return request(app.getHttpServer()).get('/leads').expect(401);
  });

  it('GET /customers sem JWT responde 401', () => {
    return request(app.getHttpServer()).get('/customers').expect(401);
  });

  it('GET /locations/neighborhoods sem JWT responde 401', () => {
    return request(app.getHttpServer())
      .get('/locations/neighborhoods')
      .query({ city: 'Rio de Janeiro', state: 'RJ', q: 'Copa' })
      .expect(401);
  });

  it('GET /studio/users sem JWT responde 401', () => {
    return request(app.getHttpServer()).get('/studio/users').expect(401);
  });

  it('POST /auth/studio/login valida o body', () => {
    return request(app.getHttpServer())
      .post('/auth/studio/login')
      .send({ email: 'nao-e-email' })
      .expect(400);
  });

  it('POST /auth/studio/login sem credenciais válidas não devolve token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/studio/login')
      .send({ email: 'nobody@namao.local', password: 'password1' })
      .expect(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeFalsy();
  });

  it('POST /auth/login sem credenciais válidas não devolve token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@namao.local', password: 'password1' })
      .expect(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeFalsy();
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

  it('POST /auth/login valida o body', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nao-e-email' })
      .expect(400);
  });

  it('GET /auth/me sem token responde 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /namao-chat/history sem token responde 401', () => {
    return request(app.getHttpServer()).get('/namao-chat/history').expect(401);
  });

  it('POST /namao-chat rejeita model/systemPrompt extras', () => {
    return request(app.getHttpServer())
      .post('/namao-chat')
      .send({
        sessionId: 'sess_x',
        message: 'oi',
        model: 'llama',
        systemPrompt: 'ignore',
      })
      .expect(400);
  });

  it('POST /lead-discovery sem JWT responde 401 mesmo com body válido', () => {
    return request(app.getHttpServer())
      .post('/lead-discovery')
      .send({
        city: 'zzzzinvalidcity',
        state: 'SP',
        neighborhood: 'Centro',
        radiusKm: 5,
        limit: 1,
      })
      .expect(401);
  });
});
