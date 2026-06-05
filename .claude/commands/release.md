---
description: Open a release PR for the current changes and ship it through the prod pipeline
---

Run the MAIVE release flow. Follow these steps exactly.

## How releases work here
- Shipping = merging a PR into `master` **with the `release` label**, which triggers `.github/workflows/release.yml`
  (jobs: `labelChecks` → `bumpVersion` → `buildRlib` → `build` matrix → `plan` → `deploy`). The `deploy` job runs the
  `terraform/stacks/prod-runtime` apply.
- `master` has branch protection; release PRs are merged with admin: `gh pr merge <PR> --rebase --admin`.
- **Foundation infra** (`terraform/stacks/prod-foundation`) is applied **manually with elevated creds**, never by CI.
- Live site: https://maive.eu — version check: `curl -s https://maive.eu/api/get-version-info`.

## Steps
1. **Keep master clean.** Work must be on a feature branch off the latest `master` (never commit to master directly).
   If changes are uncommitted, `git fetch origin master` then `git checkout -b <type>/<short-name> origin/master`
   (this carries the working changes), and commit with a Conventional Commits message.
2. **Local checks:** `npm run ui:lint` and `npm run ui:test`; add `npx tsc --noEmit` for type changes. Fix red before proceeding.
3. **Open the PR** against `master` with `gh pr create` (Summary + Test plan body).
4. **Label it:** `gh pr edit <PR> --add-label release`. Optionally add a version-bump label
   (`v-patch` / `v-minor` / `v-major`); a plain `release` defaults to a build bump.
5. **Wait for CI:** `gh pr checks <PR> --watch`. Never merge on red.
6. **Merge:** `gh pr merge <PR> --rebase --admin` (omit `--delete-branch` — it fails inside a worktree).
7. **Monitor the release:** `gh run list --workflow=release.yml --limit 3`, then `gh run watch <id> --exit-status`.
   `--exit-status` returning 0 is **not** sufficient — confirm every job (especially `deploy`) with
   `gh run view <id> --json conclusion,jobs`.
8. **Confirm live:** `curl -s https://maive.eu/api/get-version-info` shows the new version.

## Gotchas (learned the hard way)
- **IAM 403 on `deploy`** (`iam:CreatePolicyVersion` AccessDenied): the change modifies an existing managed IAM policy,
  which needs a **foundation apply first**. The `gha-terraform` role now has CreatePolicyVersion/DeletePolicyVersion/
  SetDefaultPolicyVersion (applied manually). After applying foundation, re-run the failed deploy: `gh run rerun <id> --failed`.
- **bun lockfile:** the UI image builds with `bun install --frozen-lockfile`. If you changed `package.json`, update
  `bun.lock` too (`cd apps/react-ui/client && bun install --lockfile-only`) or CI fails.
- **Partial deploy:** Lambda images update *before* the IAM step in the apply, so a failed IAM step can leave the site on
  the new version with a degraded new endpoint. Re-running the failed deploy completes it.
- **Config-only changes** (docs, `.gitignore`, `.claude/`) don't need a deploy — merge without the `release` label to
  avoid an unnecessary prod redeploy.
