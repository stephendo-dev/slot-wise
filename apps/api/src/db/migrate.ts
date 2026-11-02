import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Migrations use the direct (unpooled) connection when there is one: Neon's
// pooled endpoint runs in transaction mode, which migrations should avoid.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (see .env.example).');
  process.exit(1);
}

const pool = new Pool({ connectionString });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
