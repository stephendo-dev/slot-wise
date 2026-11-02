# SlotWise

Online booking for small service businesses: a booking page for customers, a calendar for every staff member, and one dashboard for the owner.

A portfolio project by [Stephen Do](https://www.upwork.com/freelancers/~013960591e075236da). The live demo and the full feature list arrive with the next milestones.

## Stack

- **Web**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **API**: NestJS 12, TypeScript
- **Shared**: types and helpers used by both
- **Quality**: Vitest, oxlint and ESLint, Prettier, Lighthouse CI with a 95 budget on every pull request

Landing page, Lighthouse on mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100.

## Run locally

Needs Node 24 and pnpm 12.

```bash
pnpm install
pnpm dev          # web on http://localhost:3000, API on http://localhost:4000
```

The API needs PostgreSQL. It runs on [Neon](https://neon.com): link the project with `neon init`, which writes `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to `.env.local`, and work on a development branch (`neon checkout dev --create`), not `production`. Then apply the migrations:

```bash
pnpm db:migrate   # reads .env.local; DATABASE_URL_UNPOOLED, else DATABASE_URL
```

Change the schema in `apps/api/src/db/schema.ts`, then `pnpm --filter api db:generate` writes a SQL migration to `apps/api/drizzle/`.

The API tests never touch Neon. They use a throwaway Postgres in Docker:

```bash
pnpm db:up        # Postgres on localhost:5432
DATABASE_URL=postgres://slotwise:slotwise@localhost:5432/slotwise_test pnpm db:migrate
pnpm test
pnpm db:down
```

`GET /health` on the API returns the version and `database: up`, or `503` and `database: down`.

Checks, as CI runs them:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm lighthouse   # runs against the production build
```

## Layout

```
apps/web         Next.js app
apps/api         NestJS API
packages/shared  shared types and helpers
```

Environment variables: see `.env.example`. Secrets never go into the repository.
