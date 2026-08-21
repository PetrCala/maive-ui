# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MAIVE (Meta-Analysis Instrumental Variable Estimator) is a tool for detecting spurious precision in meta-analysis data. The application consists of:

- **React UI** (Next.js 14): Interactive frontend for data upload, analysis, and visualization
- **R Backend** (Plumber): Statistical analysis service running MAIVE algorithms
- **AWS Infrastructure**: Fully serverless. Both the UI and the R backend run as AWS Lambda functions exposed via Lambda Function URLs, fronted by Cloudflare (CDN/TLS/WAF)

## Citation

**CRITICAL**: The Nature Communications (2025) paper is the canonical reference for MAIVE and must be cited everywhere users see references to the method or application.

**RTMA exception**: RTMA is Mathur's method, not MAIVE's. Wherever users see RTMA results or RTMA documentation, cite Mathur (2024, Research Synthesis Methods, doi:10.1002/jrsm.1701) as the method and the `phacking` R package (Mathur & Braginsky, 2023) as the software, with the MAIVE app cited as the application. The registry in [citationUtils.ts](apps/react-ui/client/src/utils/citationUtils.ts) encodes this; use `getCitationsForModel(modelType)` rather than hardcoding either citation.

**Official Citation**:

```text
Irsova, Z., Bom, P.R.D., Havranek, T., & Rachinger, H. (2025).
Spurious precision in meta-analysis of observational research.
Nature Communications, 16, 8454. https://doi.org/10.1038/s41467-025-63261-0
```

**When updating references**:

- Always use the Nature Communications (2025) paper as the primary reference for MAIVE-family models (RTMA follows the exception above)
- Ensure all UI components, text, tooltips, and documentation reference this paper
- The citation is already implemented in the UI via [CitationBox.tsx](apps/react-ui/client/src/components/CitationBox.tsx) and [citationUtils.ts](apps/react-ui/client/src/utils/citationUtils.ts)
- Update the MAIVE R package `DESCRIPTION` and `inst/CITATION` files to reference this paper
- Never reference working papers or preprints as the primary citation

## Commands

### Development

```bash
# UI development
npm run ui:dev          # Start Next.js dev server (localhost:3000)
npm run ui:test         # Run Vitest tests
npm run ui:lint         # Lint and format check
npm run ui:lint -- --fix # Auto-fix linting issues

# R backend development
npm run r:dev           # Start R Plumber locally (localhost:8787)
npm run r:test-e2e      # Run R end-to-end tests

# Local containerized development
npm run start:dev       # Build and start all services with Podman
npm run stop            # Stop and remove containers
```

### Container Management

```bash
npm run images:build            # Build all images
npm run images:rebuild          # Force rebuild all images
npm run images:rebuild-react    # Force rebuild React image only
npm run images:rebuild-lambda   # Force rebuild R backend image only
```

### AWS Deployment

```bash
npm run cloud:init      # Deploy foundation infrastructure (ECR, IAM/OIDC, S3 state, logs)
npm run cloud:status    # Get all service URLs and status
npm run cloud:ui-url    # Get UI frontend URL
npm run cloud:lambda-url # Get R backend URL
npm run cloud:destroy   # Destroy all infrastructure
```

### Release Management

```bash
npm run release         # Open release PR
npm run mergePR         # Merge PR (auto-detects current branch)
npm run mergePR:admin   # Merge PR with admin privileges
```

## Architecture

### Serverless Architecture

The application is fully serverless. Both the Next.js UI and the R-Plumber backend run as AWS Lambda functions, each exposed via a Lambda Function URL. Cloudflare sits in front of the UI for CDN, TLS, and WAF:

```
Browser ──► Cloudflare ──► UI Lambda Function URL (Next.js)
            (CDN/TLS/WAF)          │ SigV4-signed
                                   ▼
                           R Lambda Function URL (Plumber, IAM auth)
```

**Key Points:**

- The Next.js UI runs on AWS Lambda via a container image using the [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter), exposed through a Lambda Function URL.
- Cloudflare fronts the UI for CDN/TLS/WAF. A Cloudflare Worker rewrites the `Host`/SNI to the `.on.aws` origin, because Lambda Function URLs reject a foreign `Host` header.
- The R backend is a separate Lambda Function URL with **IAM auth** (`AWS_IAM`, no CORS): only the UI Lambda and the orchestrator hold `lambda:InvokeFunctionUrl`, and both SigV4-sign their requests (#530).
- The browser never calls the R Lambda. `modelService` POSTs to same-origin `/api/run-model` / `/api/run-rtma`; the Next.js server signs and forwards to the R backend (`src/api/server/rBackendProxy.ts`).
- Next.js API routes (e.g. `/api/run-model`, `/api/ping`, `/api/get-version-info`) run server-side inside the UI Lambda.
- There is no longer an ALB, ECS/Fargate cluster, or VPC public/private-subnet serving path.

**Domains:**

- `easymeta.org` is the canonical address. It and `maive.eu` (apex + `www` on both) are proxied through Cloudflare and serve the app.
- `spuriousprecision.com` (apex + `www`) 301-redirects to `easymeta.org`.
- `api.maive.eu` is the public API hostname.

### Directory Structure

```
apps/
├── react-ui/client/          # Next.js frontend
│   ├── src/
│   │   ├── api/              # API layer
│   │   │   ├── client/       # Client-side API calls (Next.js routes + R backend)
│   │   │   ├── services/     # Isomorphic services (R backend communication)
│   │   │   └── utils/        # API utilities and config
│   │   ├── components/       # React components (PascalCase)
│   │   ├── pages/            # Next.js pages and API routes
│   │   │   └── api/          # Next.js API routes (server-side entry points)
│   │   ├── store/            # Zustand state management
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Utility functions
│   │   └── styles/           # Tailwind CSS
│   └── docs/                 # UI-specific documentation
└── lambda-r-backend/
    └── r_scripts/            # R Plumber service
        ├── maive_model.R     # Core MAIVE model logic
        └── tests/e2e/        # R end-to-end tests

terraform/                    # AWS infrastructure (Terragrunt)
scripts/                      # Build and deployment scripts
docs/                         # Project documentation
```

### API Request Flow

Every request from the browser targets the same-origin Next.js server; the server is the only client-facing path to the R Lambda.

**Analysis (`/run-model`):**

1. **Proxy call**: The browser's `modelService` POSTs the data and parameters to `/api/run-model` (or `/api/run-rtma`).
2. **Signed forward**: The Next.js route SigV4-signs the request with the UI Lambda's execution-role credentials and forwards it to the IAM-protected R Lambda Function URL (`src/api/server/rBackendProxy.ts`).
3. **R processing**: The R Lambda executes the MAIVE analysis.
4. **Response**: The proxy relays the R response verbatim back to the browser.

**Other routes (server-side, inside the UI Lambda):** `/api/ping`, `/api/get-version-info`, etc. These run in the Next.js server context. `getRApiUrl()` is server-only and resolves the R URL from `R_API_URL` (falling back to `NEXT_PUBLIC_DEV_R_API_URL` or `http://localhost:8787` in development).

### State Management

- **Zustand**: Global state in `src/store/dataStore.ts`
- **React Context**: App-wide providers in `src/providers/`
- State includes uploaded data, analysis parameters, and results

### Parameter Change Tracking & Alerts

The app tracks indirect parameter changes and shows alerts to users when changing one option automatically affects others.

**Location**: `apps/react-ui/client/src/utils/parameterChangeTracking.ts`

**Key Functions**:

- `detectIndirectChanges(prev, next, changedByUser)` - Compares states and finds all parameters that changed indirectly
- `detectAndDispatchAlerts(prev, next, changedByUser, showAlert)` - Detects changes and shows alerts
- `getParameterChangeMessage(param, oldValue, newValue, context)` - Generates human-readable alert messages

**Explanation Rules System**:

The system uses a rules-based approach to provide context-specific explanations for why parameters changed. Rules are defined in `EXPLANATION_RULES` array:

```typescript
// Each rule returns an explanation string or null
type ExplanationRule = (context: ChangeContext) => string | null;

const EXPLANATION_RULES: ExplanationRule[] = [
  ({ param, next, changedByUser }) => {
    if (param !== "shouldUseInstrumenting") return null;
    if (changedByUser !== "modelType") return null;
    if (next.modelType === "WLS") {
      return "**WLS** doesn't use instrumenting";
    }
    return null;
  },
  // ... more rules
];
```

**Adding New Explanation Rules**:

When adding new parameter dependencies or cascading logic:

1. Add a new rule function to `EXPLANATION_RULES` array
2. Check the `param` being changed (the indirect change)
3. Check `changedByUser` (what the user directly modified)
4. Check relevant values in `next` state
5. Return explanation string with `**emphasis**` on key terms, or `null` if rule doesn't apply

```typescript
// Example: New rule for hypothetical feature
({ param, next, changedByUser }) => {
  if (param !== "newParam") return null;
  if (changedByUser === "triggerParam" && next.someCondition) {
    return "**NewParam** requires **TriggerParam** to be enabled";
  }
  return null;
},
```

**Message Format**:

- Base: `**Parameter** set to **Value**`
- With explanation: `**Parameter** set to **Value** because **reason**`
- Use `**text**` for emphasis (rendered with distinct styling in alerts)

**Internal Parameters (excluded from alerts)**:

Some parameters are internal/hidden from the user and excluded from alerts:
- `shouldUseInstrumenting`: Controlled by model type, not shown in UI
- `includeStudyClustering`: Always hidden, auto-set based on data

**Current Rules Cover**:

| Changed Param | Trigger | Explanation |
|---------------|---------|-------------|
| `computeAndersonRubin` | `modelType`, `weight`, `includeStudyDummies` | AR CI availability constraints |
| `weight` | `modelType` | Adjusted weights requires instrumenting |
| `maiveMethod` | `modelType → WAIVE` | WAIVE only supports PET-PEESE |
| `useLogFirstStage` | `modelType → WAIVE` | Log first stage recommended for WAIVE |

### Reproducibility Package System

The app generates downloadable reproducibility packages (ZIP files) that allow users to re-run analyses locally using R. This system is critical for scientific reproducibility and must stay synchronized with the R backend.

**Location**: `apps/react-ui/client/src/lib/reproducibility/`

**Key Files**:

- `generators/wrapperScript.ts` - Generates the main `run_analysis.R` script
- `githubFetcher.ts` - Fetches R source code from the backend repository
- `csvConverter.ts` - Converts user data to CSV format
- `index.ts` - Main package generation orchestration

**Critical Coupling with R Backend**:

The generated `run_analysis.R` script calls `run_maive_model()` from `apps/lambda-r-backend/r_scripts/maive_model.R`. This function expects **JSON strings** (not R objects) because it's designed for the Plumber API:

```r
# ✅ Correct - from wrapperScript.ts
results <- run_maive_model(
  jsonlite::toJSON(data, dataframe = "rows"),
  jsonlite::toJSON(parameters, auto_unbox = TRUE)
)

# ❌ Incorrect - will fail with "Argument 'txt' must be a JSON string"
results <- run_maive_model(data, parameters)
```

**When to Update**:

Update the reproducibility package generators when:

1. R backend function signatures change (`run_maive_model`, `get_funnel_plot_data`)
2. New analysis parameters are added to `ModelParameters` type
3. Result structure changes in `ModelResults` type
4. New R dependencies are required

**Testing Reproducibility Packages**:

Always test changes by running a complete export cycle:

```bash
# 1. Generate a package through the UI (or programmatically)
# 2. Extract the ZIP to lib/analysis/
# 3. Run the analysis script
cd lib/analysis/maive-analysis-YYYY-MM-DDTHH-MM-SS/
Rscript run_analysis.R

# 4. Verify it completes successfully and matches expected results
```

**Common Pitfalls**:

- **Type mismatches**: R backend expects JSON strings, not native R objects
- **Conditional checks**: Use `!identical(x, "NA") && !is.null(x)` for optional fields that may be strings or vectors
- **Version synchronization**: Ensure `versionInfo.maiveTag` matches the actual R package version
- **Missing dependencies**: Update required R packages list when backend adds new imports

## Code Style

### TypeScript (Frontend)

- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint with Airbnb + Next.js rules
- **Components**: PascalCase filenames (e.g., `FileUploader.tsx`)
- **Utilities/Hooks**: camelCase exports
- **Imports**: Use path aliases (`@src/*`, `@components/*`, `@api/*`, etc.)
- **Tests**: Colocate `.test.tsx` files or use `src/tests/`

#### Shared Styling System

The app uses a combination of Tailwind CSS and shared style utilities for consistency:

**Global Styles** (`src/styles/globals.css`):

- CSS custom properties for theme colors, spacing, and transitions
- Utility classes: `.card`, `.btn-primary`, `.btn-secondary`, `.surface-elevated`, etc.
- Dark mode support via `.dark` class prefix
- Use these for page-level layouts and major UI elements

**Page Layout Primitives** (`src/styles/globals.css`):

Every content page follows the same skeleton, so vertical rhythm is decided in one place rather than per page:

```jsx
<main className="content-page-container">   {/* page gutter + background */}
  <div className="page-shell">              {/* centred column, width modifier optional */}
    <div className="page-header">…title, description, title-row controls…</div>
    <div className="page-stack">…cards, alert stacks, action rows…</div>
  </div>
</main>
```

- `.page-shell` centres the column at 56rem. Modifiers: `.page-shell-narrow` (48rem), `.page-shell-wide` (64rem), `.page-shell-full` (80rem). **Never add horizontal padding to a shell**: the gutter belongs to `.content-page-container`, and a second gutter makes that page narrower than its neighbours.
- `.page-header` owns the gap under a page's title block (`--page-header-gap`). Put it on the wrapper, not the heading, so the gap does not shift when a description is present.
- `.page-stack` owns the gap between top-level blocks (`--page-block-gap`) via `> * + *`. **Do not also put `mt-*`/`mb-*` on its children** - the two stack and double the gap.
- Inside a card, use Tailwind `space-y-*` or `gap-*`, but only one mechanism per container. Mixing `gap-6` with `mb-2` on the children is how the gaps drifted apart in the first place.
- Prefer `SectionHeading`'s `description` prop over a hand-rolled `<p>` under the heading; it carries the right typography and internal spacing.

**Form Styles** (`src/styles/formStyles.ts`):

- Shared constants for form elements (inputs, selects, buttons)
- Use `INPUT_FIELD_CLASSES` for all text inputs and select dropdowns
- Use `getToggleButtonClasses()` for toggle buttons (Yes/No, AND/OR)
- Use `SECONDARY_BUTTON_CLASSES` for secondary action buttons
- Use `LABEL_CLASSES` for form field labels
- **Always prefer these shared constants over inline Tailwind classes for form elements**

**When to use each approach**:

- **Global CSS classes**: Page containers, page shells/headers/stacks, cards, primary/secondary buttons via ActionButton component
- **Form style constants**: All form inputs, selects, labels, and form-specific buttons
- **Inline Tailwind**: Layout utilities (flex, grid, spacing), one-off styling exceptions
- **Component-specific styles**: Only when truly unique to that component

#### Constants and Configuration

The app uses centralized constants for all static values:

**`CONST.ts`** - Immutable application constants:

- App metadata (name, creator, institution)
- External links (MAIVE website, GitHub, documentation)
- GitHub repository configuration for reproducibility
- Enum-like values (model types, methods, alert types)
- **Never hardcode URLs, owner names, or static text** - always use `CONST`

**`CONFIG.ts`** - Mutable configuration settings:

- Feature flags (bootstrap enabled, WAIVE enabled)
- UI behavior toggles (tooltips, modals)
- Default model parameters

**Usage pattern:**

```typescript
// ✅ Good - using constants
import CONST from "@src/CONST";
const repoUrl = CONST.LINKS.APP_GITHUB.HOMEPAGE;
const owner = CONST.REPRODUCIBILITY.GITHUB.OWNER;

// ❌ Bad - hardcoding values
const repoUrl = "https://github.com/PetrCala/maive-ui";
const owner = "PetrCala";
```

**When to use each:**

- `CONST.ts`: URLs, GitHub references, display names, external links, repository paths
- `CONFIG.ts`: Feature toggles, default settings, behavior flags
- Inline: True one-offs that will never change (e.g., magic numbers with clear context)

### R (Backend)

- **Naming**: snake_case for functions and variables
- **Style**: Follow tidyverse conventions
- **Modularity**: Keep helpers reusable for Lambda packaging
- **Tests**: E2E scenarios in `tests/e2e/scenarios/`

## Testing

### Frontend Tests

- **Framework**: Vitest + Testing Library
- **Location**: `apps/react-ui/client/src/tests/` or colocated `*.test.tsx`
- **Approach**: Assert on visible behavior and accessibility roles (avoid snapshots)
- **Queries**: Use `screen.findByRole` and semantic queries
- **Run**: `npm run ui:test`

### R Backend Tests

- **Framework**: R testthat (E2E scenarios)
- **Location**: `apps/lambda-r-backend/r_scripts/tests/e2e/scenarios`
- **Fixtures**: Extend existing fixtures rather than hardcoding paths
- **Run**: `npm run r:test-e2e` or `npm run lambda:test`
- **Coverage**: Add smoke tests for new scripts or data pipelines

## Commit Guidelines

Follow Conventional Commits format:

```
<type>: <description>
```

**Allowed types**: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`

**Rules**:

- Header must not exceed 100 characters
- Use lowercase for type
- Include `BREAKING CHANGE:` footer for breaking changes

**Examples**:

- ✅ `feat: add publication bias bootstrap options`
- ✅ `fix: resolve DNS resolution in VPC environment`
- ❌ `added new feature`

## Environment Configuration

### Development

```bash
# React UI
NEXT_PUBLIC_DEV_R_API_URL=http://localhost:8787

# R Backend
R_HOST=127.0.0.1
R_PORT=8787
```

### Production

```bash
# React UI (UI Lambda): the IAM-protected R Lambda Function URL. Server-only;
# the /api/run-model and /api/run-rtma routes sign and forward to it.
R_API_URL=https://<r-lambda-id>.lambda-url.<region>.on.aws
```

**Important**: Copy `apps/react-ui/client/env.example` for local secrets. Never commit `.env` files.

## Deployment Notes

- **Release workflow**: there is no `release` branch. `release.yml` triggers on any PR merged into `master` that carries the `release` label; the merge itself starts the build and deploy
- **Version bumping**: Add `v-build`, `v-patch`, `v-minor`, or `v-major` labels
- **Automation**: Use `npm run release` to open release PR, `npm run mergePR` to merge
- **Infrastructure**: Defer to maintainer for `cloud:*` and `images:*` commands
- **Quarterly releases**: `quarterly-release.yml` opens a version-bump PR on Jan 1, Apr 1, Jul 1, Oct 1. It only bumps `package.json`; it never applies the `release` label, so merging it does not deploy anything on its own

## Common Issues

### Analysis Requests Fail to Reach the R Backend

The browser posts to `/api/run-model`, which the UI Lambda signs and forwards to the R Lambda Function URL (IAM auth). If analysis requests fail, verify:

1. `R_API_URL` is set on the UI Lambda and points to the R Lambda Function URL.
2. The UI Lambda role has `lambda:InvokeFunctionUrl` on the R function (a 403 from the Function URL means the signature or the permission is wrong).
3. The R Function URL's authorization type is `AWS_IAM` and the caller actually signed the request (`src/api/server/rBackendProxy.ts` signs only `.on.aws` hosts; local targets stay unsigned).

### Cloudflare / Function URL Host Mismatch

The UI is served via Cloudflare in front of a Lambda Function URL. Lambda Function URLs reject requests with a foreign `Host` header, so a Cloudflare Worker rewrites the `Host`/SNI to the `.on.aws` origin. If the UI returns 403s from the origin, check that the Worker is rewriting the host correctly.

### Server-Side vs Client-Side Code

- **Server-side**: API routes in `src/pages/api/*` (run inside the UI Lambda)
- **Client-side**: Components, client API calls in `src/api/client/*`
- **Services**: `src/api/services/*` are client-side wrappers over the same-origin `/api` routes; server code reaches the R backend through `src/api/server/rBackendProxy.ts` (`getRApiUrl()` is server-only)
- **Check**: `typeof window === "undefined"` for server-side detection
- **Environment vars**: `NEXT_PUBLIC_*` accessible on client, others server-only

### Path Aliases

All imports use TypeScript path aliases defined in `tsconfig.json`:

- `@src/*` → `./src/*`
- `@components/*` → `./src/components/*`
- `@api/*` → `./src/api/*`
- (See `tsconfig.json` for full list)
