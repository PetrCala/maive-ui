# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MAIVE (Meta-Analysis for Identifying Variability and Errors) is a tool for detecting spurious precision in meta-analysis data. The application consists of:

- **React UI** (Next.js 14): Interactive frontend for data upload, analysis, and visualization
- **R Backend** (Plumber): Statistical analysis service running MAIVE algorithms
- **AWS Infrastructure**: Deployed on ECS with ALB, VPC, and Lambda

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
npm run cloud:init      # Deploy foundation infrastructure (VPC, ECR, S3)
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

### Two-Tier Architecture

The application uses a server-side API pattern to solve VPC network constraints:

```
Browser → Next.js API Routes → R-Plumber Service
          (Public Subnet)      (Private Subnet)
```

**Key Points:**

- Client-side code cannot directly access R service (private subnet isolation)
- All requests flow through Next.js API routes (`/api/*`)
- API routes run server-side and communicate with R service via internal VPC network
- This enables secure deployment while maintaining browser compatibility

### Directory Structure

```
apps/
├── react-ui/client/          # Next.js frontend
│   ├── src/
│   │   ├── api/              # API layer
│   │   │   ├── client/       # Client-side API calls to Next.js routes
│   │   │   ├── services/     # Server-side services (R backend communication)
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

1. **Client request**: Browser calls Next.js API route (e.g., `/api/run-model`)
2. **API route**: Validates request and calls server-side service
3. **Service layer**: Makes HTTP request to R-Plumber backend
4. **R processing**: R service executes MAIVE analysis
5. **Response**: Data flows back through service → API route → client

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

**Form Styles** (`src/styles/formStyles.ts`):

- Shared constants for form elements (inputs, selects, buttons)
- Use `INPUT_FIELD_CLASSES` for all text inputs and select dropdowns
- Use `getToggleButtonClasses()` for toggle buttons (Yes/No, AND/OR)
- Use `SECONDARY_BUTTON_CLASSES` for secondary action buttons
- Use `LABEL_CLASSES` for form field labels
- **Always prefer these shared constants over inline Tailwind classes for form elements**

**When to use each approach**:

- **Global CSS classes**: Page containers, cards, primary/secondary buttons via ActionButton component
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
# React UI (server-side only)
R_API_URL=https://internal-maive-r-alb-...elb.amazonaws.com
NEXT_PUBLIC_R_API_URL=  # Not used in production (server-side routing)
```

**Important**: Copy `apps/react-ui/client/env.example` for local secrets. Never commit `.env` files.

## Deployment Notes

- **Release workflow**: PRs to `release` branch trigger `release.yml` GitHub Actions
- **Version bumping**: Add `v-build`, `v-patch`, `v-minor`, or `v-major` labels
- **Automation**: Use `npm run release` to open release PR, `npm run mergePR` to merge
- **Infrastructure**: Defer to maintainer for `cloud:*` and `images:*` commands
- **Quarterly releases**: Automated releases on Jan 1, Apr 1, Jul 1, Oct 1

## Common Issues

### DNS Resolution in VPC

If browser shows DNS errors for internal ALB addresses, verify:

1. Requests go through `/api/*` routes (check Network tab)
2. `R_API_URL` is set correctly in ECS task environment
3. API routes properly call server-side services (not client-side)

### Server-Side vs Client-Side Code

- **Server-side**: API routes in `src/pages/api/*`, services in `src/api/services/*`
- **Client-side**: Components, client API calls in `src/api/client/*`
- **Check**: `typeof window === "undefined"` for server-side detection
- **Environment vars**: `NEXT_PUBLIC_*` accessible on client, others server-only

### Path Aliases

All imports use TypeScript path aliases defined in `tsconfig.json`:

- `@src/*` → `./src/*`
- `@components/*` → `./src/components/*`
- `@api/*` → `./src/api/*`
- (See `tsconfig.json` for full list)
