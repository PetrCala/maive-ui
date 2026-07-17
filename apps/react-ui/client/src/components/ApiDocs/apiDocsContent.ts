/**
 * Copy and code samples for the public API docs page.
 *
 * Mirrors docs/PUBLIC_API.md; docs/api/openapi.yaml is the source of truth for
 * the contract, so keep the tables below in sync with it when /v1 changes.
 */

import CONST from "@src/CONST";

const BASE_URL = CONST.LINKS.PUBLIC_API.BASE_URL;

export type EndpointRow = {
  method: string;
  path: string;
  kind: "Sync" | "Async" | "Meta";
  description: string;
};

export const ENDPOINTS: EndpointRow[] = [
  {
    method: "POST",
    path: "/v1/run-model",
    kind: "Sync",
    description: "Run MAIVE, WAIVE, or WLS and get the result in the response.",
  },
  {
    method: "POST",
    path: "/v1/run-rtma",
    kind: "Sync",
    description: "Run RTMA and get the result in the response.",
  },
  {
    method: "POST",
    path: "/v1/runs",
    kind: "Async",
    description: "Queue a run; returns a jobId immediately.",
  },
  {
    method: "GET",
    path: "/v1/runs/{jobId}",
    kind: "Async",
    description: "Poll a run; returns the result once it has succeeded.",
  },
  {
    method: "GET",
    path: "/v1/health",
    kind: "Meta",
    description: "Health check.",
  },
];

export type DataFieldRow = {
  field: string;
  type: string;
  requiredFor: string;
  notes: string;
};

export const DATA_FIELDS: DataFieldRow[] = [
  {
    field: "effect",
    type: "number",
    requiredFor: "MAIVE-family, RTMA",
    notes: "Estimated effect size.",
  },
  {
    field: "se",
    type: "number",
    requiredFor: "MAIVE-family, RTMA",
    notes: "Standard error; must be greater than 0.",
  },
  {
    field: "n_obs",
    type: "integer",
    requiredFor: "MAIVE-family",
    notes: "Number of observations; must be a positive integer.",
  },
  {
    field: "study_id",
    type: "string",
    requiredFor: "Optional",
    notes:
      "Enables study clustering. If present, rows must be at least unique studies plus 3.",
  },
];

export type ParameterRow = {
  name: string;
  values: string;
  defaultValue: string;
};

export const MODEL_PARAMETERS: ParameterRow[] = [
  { name: "modelType", values: "MAIVE | WAIVE | WLS", defaultValue: "MAIVE" },
  {
    name: "maiveMethod",
    values: "PET | PEESE | PET-PEESE | EK",
    defaultValue: "PET-PEESE",
  },
  {
    name: "weight",
    values:
      "equal_weights | standard_weights | adjusted_weights | study_weights",
    defaultValue: "equal_weights",
  },
  {
    name: "standardErrorTreatment",
    values: "not_clustered | clustered | clustered_cr2 | bootstrap",
    defaultValue: "clustered_cr2",
  },
  { name: "includeStudyDummies", values: "boolean", defaultValue: "false" },
  { name: "includeStudyClustering", values: "boolean", defaultValue: "false" },
  { name: "computeAndersonRubin", values: "boolean", defaultValue: "false" },
  { name: "useLogFirstStage", values: "boolean", defaultValue: "false" },
  {
    name: "winsorize",
    values: "number (percent, 0 disables)",
    defaultValue: "0",
  },
  {
    name: "shouldUseInstrumenting",
    values: "boolean",
    defaultValue: "derived: false for WLS, true otherwise",
  },
];

export const RTMA_PARAMETERS: ParameterRow[] = [
  { name: "favorPositive", values: "boolean", defaultValue: "true" },
  { name: "alphaSelect", values: "number", defaultValue: "0.05" },
  { name: "ciLevel", values: "number", defaultValue: "0.95" },
  {
    name: "winsorize",
    values: "number (percent, 0 disables)",
    defaultValue: "0",
  },
];

export type CodeSample = {
  language: string;
  label: string;
  code: string;
};

export const SYNC_EXAMPLES: CodeSample[] = [
  {
    language: "bash",
    label: "curl",
    code: `curl -s ${BASE_URL}/v1/run-model \\
  -H 'Content-Type: application/json' \\
  -d '{
    "data": [
      {"effect": 0.42, "se": 0.11, "n_obs": 120},
      {"effect": 0.31, "se": 0.06, "n_obs": 90},
      {"effect": 0.55, "se": 0.20, "n_obs": 45},
      {"effect": 0.12, "se": 0.04, "n_obs": 200}
    ]
  }'`,
  },
  {
    language: "r",
    label: "R (httr2)",
    code: `library(httr2)

body <- list(
  data = list(
    list(effect = 0.42, se = 0.11, n_obs = 120),
    list(effect = 0.31, se = 0.06, n_obs = 90),
    list(effect = 0.55, se = 0.20, n_obs = 45),
    list(effect = 0.12, se = 0.04, n_obs = 200)
  )
)

resp <- request("${BASE_URL}/v1/run-model") |>
  req_body_json(body) |>
  req_perform()

results <- resp_body_json(resp)
str(results)`,
  },
  {
    language: "python",
    label: "Python (requests)",
    code: `import requests

body = {
    "data": [
        {"effect": 0.42, "se": 0.11, "n_obs": 120},
        {"effect": 0.31, "se": 0.06, "n_obs": 90},
        {"effect": 0.55, "se": 0.20, "n_obs": 45},
        {"effect": 0.12, "se": 0.04, "n_obs": 200},
    ]
}

resp = requests.post("${BASE_URL}/v1/run-model", json=body, timeout=120)
resp.raise_for_status()
results = resp.json()
print(results["effectEstimate"], results["standardError"])`,
  },
];

export const ASYNC_EXAMPLES: CodeSample[] = [
  {
    language: "bash",
    label: "curl",
    code: `# 1. Submit
job=$(curl -s ${BASE_URL}/v1/runs \\
  -H 'Content-Type: application/json' \\
  -d '{
    "modelType": "MAIVE",
    "data": [
      {"effect": 0.42, "se": 0.11, "n_obs": 120},
      {"effect": 0.31, "se": 0.06, "n_obs": 90},
      {"effect": 0.55, "se": 0.20, "n_obs": 45},
      {"effect": 0.12, "se": 0.04, "n_obs": 200}
    ]
  }' | jq -r '.jobId')

echo "jobId: $job"

# 2. Poll until terminal
while true; do
  status=$(curl -s "${BASE_URL}/v1/runs/$job" | tee /tmp/run.json | jq -r '.status')
  echo "status: $status"
  [[ "$status" == "succeeded" || "$status" == "failed" || "$status" == "timedout" ]] && break
  sleep 3
done

# 3. Read the result
jq '.result' /tmp/run.json`,
  },
  {
    language: "r",
    label: "R (httr2)",
    code: `library(httr2)

submit_body <- list(
  modelType = "MAIVE",
  data = list(
    list(effect = 0.42, se = 0.11, n_obs = 120),
    list(effect = 0.31, se = 0.06, n_obs = 90),
    list(effect = 0.55, se = 0.20, n_obs = 45),
    list(effect = 0.12, se = 0.04, n_obs = 200)
  )
)

submit_resp <- request("${BASE_URL}/v1/runs") |>
  req_body_json(submit_body) |>
  req_perform()

job_id <- resp_body_json(submit_resp)$jobId
cat("jobId:", job_id, "\\n")

terminal_statuses <- c("succeeded", "failed", "timedout")
repeat {
  run <- request(sprintf("${BASE_URL}/v1/runs/%s", job_id)) |>
    req_perform() |>
    resp_body_json()

  cat("status:", run$status, "\\n")
  if (run$status %in% terminal_statuses) break
  Sys.sleep(3)
}

if (run$status == "succeeded") {
  str(run$result)
} else {
  stop(run$errorMessage)
}`,
  },
  {
    language: "python",
    label: "Python (requests)",
    code: `import time
import requests

submit_body = {
    "modelType": "MAIVE",
    "data": [
        {"effect": 0.42, "se": 0.11, "n_obs": 120},
        {"effect": 0.31, "se": 0.06, "n_obs": 90},
        {"effect": 0.55, "se": 0.20, "n_obs": 45},
        {"effect": 0.12, "se": 0.04, "n_obs": 200},
    ],
}

submit_resp = requests.post("${BASE_URL}/v1/runs", json=submit_body, timeout=30)
submit_resp.raise_for_status()
job_id = submit_resp.json()["jobId"]
print("jobId:", job_id)

terminal_statuses = {"succeeded", "failed", "timedout"}
while True:
    run = requests.get(f"${BASE_URL}/v1/runs/{job_id}", timeout=30).json()
    print("status:", run["status"])
    if run["status"] in terminal_statuses:
        break
    time.sleep(3)

if run["status"] == "succeeded":
    print(run["result"])
else:
    raise RuntimeError(run.get("errorMessage"))`,
  },
];

export const ERROR_ENVELOPE_EXAMPLE = `{
  "error": {
    "code": "validation_error",
    "message": "Data must have 3 or 4 columns; found 6."
  }
}`;

export const MINIMAL_REQUEST_EXAMPLE = `{
  "data": [
    {"effect": 0.42, "se": 0.11, "n_obs": 120},
    {"effect": 0.31, "se": 0.06, "n_obs": 90},
    {"effect": 0.55, "se": 0.20, "n_obs": 45},
    {"effect": 0.12, "se": 0.04, "n_obs": 200}
  ]
}`;

export type ErrorCodeRow = {
  code: string;
  status: string;
  meaning: string;
};

export const ERROR_CODES: ErrorCodeRow[] = [
  {
    code: "validation_error",
    status: "400",
    meaning: "The request body failed validation.",
  },
  {
    code: "not_found",
    status: "404",
    meaning: "Unknown or expired jobId.",
  },
  {
    code: "method_not_allowed",
    status: "405",
    meaning: "The HTTP method is not supported on this route.",
  },
  {
    code: "payload_too_large",
    status: "413",
    meaning:
      "The dataset is too large to queue (roughly 200KB of JSON). Use a synchronous endpoint instead.",
  },
  {
    code: "rate_limited",
    status: "429",
    meaning: "Edge rate limit or the backend concurrency cap was hit.",
  },
  {
    code: "internal_error",
    status: "500",
    meaning: "An unexpected server-side error occurred.",
  },
  {
    code: "not_configured",
    status: "503",
    meaning: "This deployment has no async runs infrastructure configured.",
  },
];
