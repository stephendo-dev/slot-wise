import { defineConfig } from 'vitest/config';

// The API tests never read .env.local, which points at the live Neon branch.
// They use a throwaway Postgres: `pnpm db:up` locally, a service container in CI.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://slotwise:slotwise@localhost:5432/slotwise_test';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
