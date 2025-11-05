# Repository Guidelines


## Project Structure & Module Organization

The interface lives in `apps/react-ui/client`, a Next 14 + TypeScript app using Tailwind. Lambda-ready R code sits in `apps/lambda-r-backend/r_scripts` with reusable models in `maive_model.R` and E2E suites under `tests/e2e`. Shared documentation and assets stay in `docs/` and `lib/`, while developer tooling and automation scripts reside in `scripts/`; cloud definitions are stored under `terraform/` for reference.

## Build, Test, and Development Commands

For UI work rely on `npm run ui:dev` (Next dev server with hot reload), `npm run ui:test` (Vitest + Testing Library), and `npm run ui:lint` (ESLint + Prettier). Analytics changes can be verified with `npm run lambda:test` or the focused R suite `npm run r:test-e2e`. When TypeScript or lint rules are updated, run `npm run ui:lint -- --fix` to keep the tree consistent. Infrastructure scripts exist but deployment, container orchestration, and registry management are handled separately—coordinate with the maintainer before invoking them.

## Coding Style & Naming Conventions

UI code is TypeScript with 2-space indentation, Prettier defaults, and Airbnb/Next linting rules; keep shared React components in `src/components` using PascalCase filenames (e.g., `FileUploader.tsx`), hooks and utilities in `src/utils` or `src/lib` with camelCase exports, and colocate `.test.tsx` files beside the source. Tailwind classes should mirror design tokens defined in `src/styles`. R scripts remain snake_case and follow tidyverse conventions; keep reusable helpers modular so Lambda packaging stays lean.

## Testing Guidelines

Place Vitest suites inside `apps/react-ui/client/src/tests` or next to the feature using the `*.test.tsx` suffix and Testing Library queries (`screen.findByRole`). Snapshot testing is discouraged; assert on visible behavior and accessibility roles instead. R end-to-end scenarios live in `apps/lambda-r-backend/r_scripts/tests/e2e/scenarios`; extend the fixtures rather than hardcoding paths and run `npm run r:test-e2e` before PRs that touch analytics logic. Add smoke coverage when introducing new scripts or data pipelines.

## Commit & Pull Request Guidelines

Commits follow Conventional Commits (`feat`, `fix`, `docs`, `test`, etc.) with headers under 100 characters and optional `BREAKING CHANGE` footers. Bundle related work per commit to keep `openPR.sh` automation predictable. Pull requests should target the `release` branch for production work and describe scope, risks, and manual verification; include issue links and screenshots for UI updates, plus Terraform plan summaries when infra files change.

## Environment & Collaboration Notes

Copy `apps/react-ui/client/env.example` when establishing local secrets and keep `.env` files untracked. Stick to Next.js defaults for local development unless a maintainer specifies otherwise. Deployments, container lifecycle management, and AWS configuration are orchestrated separately; defer to the project owner for those workflows and avoid running `cloud:*`, `images:*`, or similar scripts unless explicitly coordinated.
