import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/db/database.service.js';

describe('GET /health', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports the version and database: up when the database answers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ version: '0.0.1', database: 'up' });
  });

  it('answers 503 with database: down when the database is unreachable', async () => {
    const unreachable = new Pool({
      connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none',
      connectionTimeoutMillis: 500,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(unreachable)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({ version: '0.0.1', database: 'down' });
  });
});
