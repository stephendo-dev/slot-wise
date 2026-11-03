import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export const PG_POOL = Symbol('PG_POOL');

export function createPool(connectionString = process.env.DATABASE_URL): Pool {
  const logger = new Logger('Database');
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
  });
  // An idle client can fail (network drop, server restart). Without this
  // handler the error is unhandled and takes the process down.
  pool.on('error', (error) => logger.error(`idle client: ${error.message}`));
  return pool;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: NodePgDatabase<typeof schema>;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.db = drizzle({ client: pool, schema });
  }

  async isUp(): Promise<boolean> {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
