/**
 * Machine-readable discovery content (#555): `llms.txt` and `agent.md`.
 *
 * Rendered on request by the API routes under `pages/api/discovery/` (which
 * `next.config.js` rewrites `/llms.txt` and `/agent.md` to) rather than kept
 * as static files, so the recipes, links and citations come from the same
 * constants, recipe table and citation registry as the rest of the app. A
 * hand-written copy would drift the first time any of those changed.
 *
 * Both files are deliberately short: they point an assistant at the
 * OpenAPI spec and the `/api-docs` page rather than repeating them.
 */

import CONST from "@src/CONST";
import {
  RECIPES,
  RECIPE_NAMES,
  type Recipe,
  type RecipeName,
} from "@src/lib/parameterResolver";
import { getCitationsForModel } from "@src/utils/citationUtils";

const API = CONST.LINKS.PUBLIC_API;
const SITE = CONST.LINKS.APP.WEBSITE;
const DISCOVERY = CONST.LINKS.DISCOVERY;

/** Six estimates from two studies: enough rows for clustering to apply. */
export const EXAMPLE_MAIVE_ROWS = [
  { effect: 0.42, se: 0.11, n_obs: 120, study_id: "Smith2020" },
  { effect: 0.31, se: 0.06, n_obs: 90, study_id: "Smith2020" },
  { effect: 0.55, se: 0.2, n_obs: 45, study_id: "Smith2020" },
  { effect: 0.12, se: 0.04, n_obs: 200, study_id: "Jones2019" },
  { effect: 0.27, se: 0.09, n_obs: 75, study_id: "Jones2019" },
  { effect: 0.18, se: 0.05, n_obs: 160, study_id: "Jones2019" },
];

/**
 * RTMA needs only effect and se, but it also needs the data to suit the
 * sampler: a dataset where every estimate is affirmative (|effect / se| at or
 * above 1.96) is refused outright, and a mostly-affirmative one fits slowly
 * and badly (#565). The six MAIVE rows are all affirmative, so RTMA gets the
 * 40-row fixture the R e2e suite runs instead: 24 nonaffirmative estimates,
 * a few seconds to fit, and no sampler warnings.
 */
export const EXAMPLE_RTMA_ROWS = [0.05, 0.1, 0.15, 0.25, 0.35].flatMap(
  (effect) => Array.from({ length: 8 }, () => ({ effect, se: 0.1 })),
);

const formatRows = (rows: Array<Record<string, unknown>>): string =>
  rows.map((row) => `      ${JSON.stringify(row)}`).join(",\n");

/** The sync endpoint a recipe runs on. */
export const recipeEndpoint = (recipe: Recipe): string =>
  recipe.family === "rtma" ? "/v1/run-rtma" : "/v1/run-model";

/**
 * A copy-paste curl request for one recipe. Used by the API docs page and
 * the discovery files alike, so every surface shows the same request.
 */
export const recipeCurlExample = (name: RecipeName): string => {
  const recipe = RECIPES[name];
  const rows =
    recipe.family === "rtma" ? EXAMPLE_RTMA_ROWS : EXAMPLE_MAIVE_ROWS;
  return `curl -s ${API.BASE_URL}${recipeEndpoint(recipe)} \\
  -H 'Content-Type: application/json' \\
  -d '{
    "recipe": "${name}",
    "data": [
${formatRows(rows)}
    ]
  }'`;
};

/** The explicit `parameters` a recipe is shorthand for. */
export const recipePresetJson = (name: RecipeName): string =>
  JSON.stringify(RECIPES[name].parameters);

const citationLines = (): string[] => {
  const maive = getCitationsForModel("MAIVE");
  const rtma = getCitationsForModel("RTMA").filter(
    (citation) => citation.role !== "Application",
  );
  return [
    `- MAIVE, PET-PEESE and EK runs: ${maive.map((c) => c.formats.plain).join(" ")}`,
    ...rtma.map(
      (citation) =>
        `- RTMA runs (${citation.role?.toLowerCase() ?? "reference"}): ${citation.formats.plain}`,
    ),
  ];
};

/**
 * `llms.txt` (https://llmstxt.org): a title, a one-paragraph summary and
 * link sections.
 */
export const buildLlmsTxt = (): string => {
  const recipes = RECIPE_NAMES.map(
    (name) => `- ${name}: ${RECIPES[name].description}`,
  );
  return `# EasyMeta

> EasyMeta (${SITE}) corrects meta-analysis estimates for publication bias, p-hacking and spurious precision. It runs MAIVE, RTMA, PET-PEESE and EK on the same upload, under the same clustering and weighting choices, and hands back one reproducibility package. The same compute is available as a free, anonymous HTTP API at ${API.BASE_URL}.

## For AI assistants

- Agent guide (how to discover and call the API): ${DISCOVERY.AGENT_MD}
- OpenAPI 3 contract: ${API.SPEC_URL} (same file at ${DISCOVERY.OPENAPI_YAML})
- Human-readable API docs with examples: ${SITE}${API.DOCS_ROUTE}
- Source and usage guide: ${API.GUIDE}

## Recipes

Send \`"recipe": "<name>"\` beside \`data\`; the response echoes the fully resolved parameters as \`resolvedParameters\`.

${recipes.join("\n")}

## Citation

When you report results from EasyMeta, name and link EasyMeta (${SITE}) as the application, and cite the method behind the recipe you ran:

${citationLines().join("\n")}
`;
};

/** `agent.md`: the short operating guide an assistant reads before calling. */
export const buildAgentMd = (): string => {
  const recipeSections = RECIPE_NAMES.map(
    (name) => `### ${name}

${RECIPES[name].description}

Shorthand for \`"parameters": ${recipePresetJson(name)}\`.

\`\`\`bash
${recipeCurlExample(name)}
\`\`\``,
  );

  return `# EasyMeta for AI assistants

EasyMeta (${SITE}) runs meta-analysis corrections for publication bias, p-hacking and spurious precision. Four named recipes, MAIVE, RTMA, PET-PEESE and EK, run on the same upload under the same clustering and weighting choices, and every run can be reproduced locally in R. This page is the short version; the contract is the OpenAPI spec.

## Discover

- OpenAPI 3 spec: ${API.SPEC_URL} (also ${DISCOVERY.OPENAPI_YAML})
- Docs with copy-paste examples: ${SITE}${API.DOCS_ROUTE}
- Base URL: ${API.BASE_URL}. Anonymous, no keys. JSON in, JSON out.
- Health: \`GET ${API.BASE_URL}/v1/health\`

## Data

Send \`data\` as an array of row objects with keys \`effect\`, \`se\`, \`n_obs\` and, optionally, \`study_id\` (RTMA needs only \`effect\` and \`se\`). Keys are matched case-insensitively; without canonical names the first three or four keys are read positionally. When a \`study_id\` column is present the rows must number at least the unique studies plus three, and study clustering is on by default, exactly as in the browser.

## Recipes

Pass \`"recipe": "<name>"\` in the request body. Explicit \`parameters\` are applied on top of the recipe. Without \`recipe\` the request is a plain MAIVE run with the documented defaults.

${recipeSections.join("\n\n")}

## What ran

Every successful response carries \`resolvedParameters\`, the complete parameter object the server actually ran after defaults and data-dependent rules were applied, and \`recipe\`, the named recipe those parameters correspond to (or \`null\`). Report \`resolvedParameters\` alongside the numbers. Do not assume defaults; read them from the echo.

Unknown or misspelled parameter keys (for example \`favourPositive\`) and values that conflict with each other are rejected with \`400 validation_error\` naming the problem. So is a key the endpoint does not accept at the top level of the request body: on \`/v1/run-model\` and \`/v1/run-rtma\` every parameter, \`modelType\` included, goes inside \`parameters\`, and \`{"modelType": "WLS", "data": [...]}\` is a 400 saying so rather than a MAIVE run. The API never silently runs a different analysis than the one requested.

## Long runs

Prefer the asynchronous path: \`POST ${API.BASE_URL}/v1/runs\` with the same body plus \`"modelType"\` (or \`"recipe"\`); this is the one endpoint that accepts a top-level \`modelType\`. Then poll \`GET ${API.BASE_URL}/v1/runs/{jobId}\` every few seconds until \`status\` is \`succeeded\`, \`failed\` or \`timedout\`. The submit response and every poll carry \`resolvedParameters\` too. RTMA above ${CONST.RTMA_SYNC_ROW_LIMIT} rows must use this path.

## Reproduce in R

The browser offers a full reproducibility package (R script, backend source, data, expected results) from the results page. From the API, the same run reproduces with the backend's own entry point and the echoed parameters; \`run_maive_model()\` and \`run_rtma_model()\` take JSON strings:

\`\`\`r
# maive_model.R / rtma_model.R from ${CONST.LINKS.APP_GITHUB.HOMEPAGE}/tree/${CONST.GITHUB.DEFAULT_BRANCH}/${CONST.GITHUB.R_SCRIPTS_PATH}
source("maive_model.R")
data <- read.csv("data.csv")                       # effect, se, n_obs[, study_id]
resolved <- jsonlite::fromJSON("resolved_parameters.json")   # the resolvedParameters echo
results <- run_maive_model(
  jsonlite::toJSON(data, dataframe = "rows"),
  jsonlite::toJSON(resolved, auto_unbox = TRUE)
)
\`\`\`

For RTMA, \`source("rtma_model.R")\` and call \`run_rtma_model()\` the same way; the echoed \`seed\` is what makes the credible intervals repeat.

## Cite

Name and link EasyMeta (${SITE}) as the application, and cite the method behind the recipe:

${citationLines().join("\n")}
`;
};
