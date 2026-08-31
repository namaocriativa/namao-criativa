import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

  it('POST /lead-discovery validates body', () => {
    return request(app.getHttpServer())
      .post('/lead-discovery')
      .send({})
      .expect(400);
  });

  it('POST /enrichment validates body', () => {
    return request(app.getHttpServer())
      .post('/enrichment')
      .send({})
      .expect(400);
  });

  it('GET /leads returns an array', async () => {
    const res = await request(app.getHttpServer()).get('/leads').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /lead-discovery validates radiusKm', () => {
    return request(app.getHttpServer())
      .post('/lead-discovery')
      .send({ city: 'São Paulo', state: 'SP', radiusKm: 100 })
      .expect(400);
  });

  it('POST /lead-discovery accepts neighborhood and radiusKm', async () => {
    const res = await request(app.getHttpServer())
      .post('/lead-discovery')
      .send({
        city: 'zzzzinvalidcity',
        state: 'SP',
        neighborhood: 'Centro',
        radiusKm: 5,
        limit: 1,
      });

    expect(res.status).not.toBe(400);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('GET /locations/neighborhoods valida query', async () => {
    const empty = await request(app.getHttpServer())
      .get('/locations/neighborhoods')
      .query({ q: 'Cop' })
      .expect(200);
    expect(empty.body).toEqual([]);

    const res = await request(app.getHttpServer())
      .get('/locations/neighborhoods')
      .query({ city: 'Rio de Janeiro', state: 'RJ', q: 'Copa', limit: 5 })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length) {
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          city: expect.any(String),
          state: expect.any(String),
          label: expect.any(String),
        }),
      );
    }
  });
});
