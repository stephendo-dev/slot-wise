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
