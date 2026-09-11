---
description: Open a release PR for the current changes and ship it through the prod pipeline
---

Run the MAIVE release flow. Follow these steps exactly.

## How releases work here
- Shipping = merging a PR into `master` **with the `release` label**, which triggers `.github/workflows/release.yml`
  (jobs: `labelChecks` → `bumpVersion` → `buildRlib` → `build` matrix → `plan` → `deploy`). The `deploy` job runs the
  `terraform/stacks/prod-runtime` apply.
- `master` has no branch protection (the API answers "Branch not protected"), so release PRs merge like any other:
  `gh pr merge <PR> --rebase`. Pin the tested head with `--match-head-commit <sha>`.
- **Foundation infra** (`terraform/stacks/prod-foundation`) is applied **manually with elevated creds**, never by CI.
- Live site: https://easymeta.org; version check: `curl -s https://easymeta.org/api/get-version-info` (`maive.eu` only redirects there now, so `curl -s` against it returns nothing).

## Steps
1. **Keep master clean.** Work must be on a feature branch off the latest `master` (never commit to master directly).
   If changes are uncommitted, `git fetch origin master` then `git checkout -b <type>/<short-name> origin/master`
   (this carries the working changes), and commit with a Conventional Commits message.
2. **Local checks:** `npm run ui:lint` and `npm run ui:test`; add `npx tsc --noEmit` for type changes. Fix red before proceeding.
3. **Open the PR** against `master` with `gh pr create` (Summary + Test plan body).
4. **Label it:** `gh pr edit <PR> --add-label release`. Optionally add a version-bump label
   (`v-patch` / `v-minor` / `v-major`); a plain `release` defaults to a patch bump (`labelChecks` in
   `release.yml`), which turns `0.9.4-0` into `0.9.5-0`.
5. **Wait for CI:** `gh pr checks <PR> --watch`. Never merge on red.
6. **Merge:** `gh pr merge <PR> --rebase --match-head-commit <sha>` (omit `--delete-branch`, which fails inside a
   worktree; the repo deletes merged branches itself).
7. **Monitor the release:** `gh run list --workflow=release.yml --limit 3`, then `gh run watch <id> --exit-status`.
   `--exit-status` returning 0 is **not** sufficient; confirm every job (especially `deploy`) with
   `gh run view <id> --json conclusion,jobs`.
8. **Confirm live:** `curl -s https://easymeta.org/api/get-version-info` shows the new version.

## Gotchas (learned the hard way)
- **IAM 403 on `deploy`** (`iam:CreatePolicyVersion` AccessDenied): the change modifies an existing managed IAM policy,
  which needs a **foundation apply first**. The `gha-terraform` role now has CreatePolicyVersion/DeletePolicyVersion/
  SetDefaultPolicyVersion (applied manually). After applying foundation, re-run the failed deploy: `gh run rerun <id> --failed`.
- **The R library image is cached by `r-packages.txt` and the MAIVE tag only.** `scripts/build-r-lib.sh` tags it
  with a hash of `r-packages.txt` plus `MAIVE_TAG` and skips the build when that tag exists in ECR, so a change to
  `Dockerfile.rlib` alone never rebuilds it. Change a pin or the tag along with it, or delete the cached image.
- **bun lockfile:** the UI image builds with `bun install --frozen-lockfile`. If you changed `package.json`, update
  `bun.lock` too (`cd apps/react-ui/client && bun install --lockfile-only`) or CI fails.
- **Partial deploy:** Lambda images update *before* the IAM step in the apply, so a failed IAM step can leave the site on
  the new version with a degraded new endpoint. Re-running the failed deploy completes it.
- **Config-only changes** (docs, `.gitignore`, `.claude/`) don't need a deploy: merge without the `release` label to
  avoid an unnecessary prod redeploy.
