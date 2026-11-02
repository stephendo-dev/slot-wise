# Repository rules

`main.json` is the branch ruleset for `main`. GitHub does not read this file by itself: apply it once, and again after you change it.

## What it enforces on `main`

- Changes go through a pull request. No approvals are required (a solo maintainer cannot approve their own pull request), stale reviews are dismissed on a new push, and every review conversation must be resolved.
- The `ci` check must pass, on a branch that is up to date with `main`. `ci` is the job in `.github/workflows/ci.yml`: format, lint, types, tests, build and Lighthouse (95 budget).
- No force push and no deletion of `main`.
- Repository admins can bypass through a pull request only, so a broken CI (for example a billing lock) never locks the repository for good.

Not required on purpose: signed commits (commits written by the coding agent are not signed) and linear history (the merge method is the maintainer's choice).

## Apply it

```bash
gh api -X POST repos/stephendo-dev/slot-wise/rulesets --input .github/rulesets/main.json
```

Update it later (find the id with `gh api repos/stephendo-dev/slot-wise/rulesets --jq '.[] | [.id,.name]'`):

```bash
gh api -X PUT repos/stephendo-dev/slot-wise/rulesets/<id> --input .github/rulesets/main.json
```

## Other settings worth turning on

```bash
# merged branches are deleted; auto-merge is available once the checks pass
gh repo edit stephendo-dev/slot-wise --delete-branch-on-merge --enable-auto-merge --enable-wiki=false --enable-projects=false

# Actions: the default token is read-only, and workflows cannot approve pull requests
gh api -X PUT repos/stephendo-dev/slot-wise/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

# secret scanning and push protection (free on public repositories), Dependabot alerts and updates
gh api -X PATCH repos/stephendo-dev/slot-wise -F 'security_and_analysis[secret_scanning][status]=enabled' -F 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
gh api -X PUT repos/stephendo-dev/slot-wise/vulnerability-alerts
gh api -X PUT repos/stephendo-dev/slot-wise/automated-security-fixes
```

Check the result in **Settings → Rules → Rulesets**.
