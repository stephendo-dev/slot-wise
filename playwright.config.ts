import { defineConfig } from '@playwright/test';

// The browser test runs the built API and web app against the throwaway test
// Postgres (never Neon): `pnpm db:up && pnpm db:migrate:test && pnpm build`.
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://slotwise:slotwise@localhost:5432/slotwise_test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // The Chrome that is already installed (CI runners and most laptops have it).
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter api start',
      url: 'http://localhost:4000/health',
      env: { DATABASE_URL, PORT: '4000' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter web start',
      url: 'http://localhost:3000',
      env: { API_URL: 'http://localhost:4000' },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
