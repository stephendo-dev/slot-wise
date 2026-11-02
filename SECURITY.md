# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting: **Security → Report a vulnerability** on this repository. You will get a first answer within 7 days.

## What this project does

- Secret scanning and push protection are on; no secrets are stored in the repository.
- Pull requests need the `ci` check; the `main` branch cannot be force-pushed or deleted (`.github/rulesets/`).
- `pnpm audit --prod --audit-level high` runs in CI: a high advisory in a production dependency fails the build.
- Dependabot opens weekly update pull requests for npm packages and GitHub Actions; actions are pinned by commit SHA.
- The demo runs on free tiers with test data only. It stores no real customer data.

## Known advisories in build tools

Both are build-time only (Lighthouse CI in the `@lhci/cli` dev dependency). They are not in the shipped apps and `pnpm audit --prod` is clean. They stay until upstream publishes a fix:

| Package                        | Advisory                                   | Why it stays                                                                        |
| ------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `extract-zip`                  | unvalidated symlink path traversal (high)  | no patched release exists; Lighthouse uses it to unpack its own Chrome download     |
| `zod` (inside `chromium-bidi`) | memory use on oversized collections (high) | the fix is Zod 4 and Lighthouse's dependency uses Zod 3; an override would break it |

Other advisories (`tmp`, `basic-ftp`, `uuid`, `minimatch`) are fixed through `overrides` in `pnpm-workspace.yaml`.
