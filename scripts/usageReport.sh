#!/bin/bash
set -eo pipefail

# Usage report for the MAIVE app over a recent window (default: the last 48 h).
#
# Reads the three sources the stack already keeps and renders one Markdown
# report on stdout (or into --out):
#
#   1. CloudWatch metrics for the UI, R backend and orchestrator Lambdas:
#      invocations, errors, throttles, duration, peak concurrency, and the UI
#      Function URL request/4xx/5xx counts, plus an hourly traffic table.
#   2. The R backend's per-request JSON log line (request_log.R, #532) through
#      CloudWatch Logs Insights: requests by endpoint, method and outcome,
#      duration percentiles, dataset sizes, the slowest requests and every
#      timeout or error. REPORT lines give cold starts and billed GB-seconds
#      for all three functions.
#   3. The runs table (#529): one record per distinct input with its outcome,
#      run and dedup counters, and the async job records.
#
# Needs the aws CLI and jq, and a profile allowed to read CloudWatch metrics
# and logs, scan the runs table, describe the Lambdas and alarms, and read the
# banner SSM parameter. Everything is read-only.

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
# shellcheck source=scripts/shellUtils.sh
source "$SCRIPTS_DIR/shellUtils.sh"

PROFILE="${AWS_PROFILE:-kiroku}"
REGION="eu-central-1"
PROJECT="maive"
HOURS=48
OUT=""
# Longest a single Logs Insights query is allowed to run before it is abandoned.
QUERY_TIMEOUT_SECONDS=120

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --hours <n>         Length of the window ending now (default: $HOURS)"
  echo "  --out <file>        Write the Markdown report to a file instead of stdout"
  echo "  --profile <profile> AWS profile to use (default: \$AWS_PROFILE or kiroku)"
  echo "  --region <region>   AWS region (default: $REGION)"
  echo "  --help              Show this help message"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --hours)
      HOURS="$2"
      shift 2
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --help | -h)
      usage
      ;;
    *)
      error "Unknown option: $1"
      usage
      ;;
  esac
done

if ! [[ "$HOURS" =~ ^[0-9]+$ ]] || ((HOURS < 1)); then
  error "--hours must be a positive integer, got '$HOURS'."
  exit 1
fi

for tool in aws jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    error "$tool is required but not installed."
    exit 1
  fi
done

export AWS_PROFILE="$PROFILE"
export AWS_REGION="$REGION"
R_FUNCTION="$PROJECT-lambda-r-backend"
UI_FUNCTION="$PROJECT-ui"
ORCHESTRATOR_FUNCTION="$PROJECT-orchestrator"
RUNS_TABLE="$PROJECT-runs"
BANNER_PARAMETER="/$PROJECT/ui/unstable_banner_enabled"

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  error "AWS CLI is not authenticated with profile $PROFILE."
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# Epoch seconds, ISO timestamps and the window length; GNU and BSD date both.
NOW_EPOCH=$(date -u +%s)
SINCE_EPOCH=$((NOW_EPOCH - HOURS * 3600))
iso_from_epoch() {
  date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ
}
NOW_ISO=$(iso_from_epoch "$NOW_EPOCH")
SINCE_ISO=$(iso_from_epoch "$SINCE_EPOCH")
WINDOW_SECONDS=$((HOURS * 3600))

info "Usage report for $PROJECT in $REGION, $SINCE_ISO to $NOW_ISO ($HOURS h)." >&2

# --- helpers ----------------------------------------------------------------

# Sum/Average/Maximum of one Lambda metric over the whole window. Prints 0 when
# there were no datapoints (CloudWatch omits periods with no data).
metric() {
  local function_name="$1" metric_name="$2" statistic="$3" value
  value=$(aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
    --metric-name "$metric_name" \
    --dimensions Name=FunctionName,Value="$function_name" \
    --start-time "$SINCE_ISO" --end-time "$NOW_ISO" \
    --period "$WINDOW_SECONDS" --statistics "$statistic" \
    --query "Datapoints[0].$statistic" --output text 2>/dev/null || echo None)
  if [[ "$value" == "None" || -z "$value" ]]; then
    echo 0
  else
    echo "$value"
  fi
}

# Hourly Sum of one Lambda metric as JSON {"<iso hour>": value, ...}.
hourly_metric() {
  local function_name="$1" metric_name="$2"
  aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
    --metric-name "$metric_name" \
    --dimensions Name=FunctionName,Value="$function_name" \
    --start-time "$SINCE_ISO" --end-time "$NOW_ISO" \
    --period 3600 --statistics Sum --output json 2>/dev/null |
    jq '[.Datapoints[] | {(.Timestamp | .[0:13] + ":00Z"): (.Sum | round)}] | add // {}'
}

# Run one Logs Insights query against LOG_GROUP and write its results JSON to
# OUT. Waits for completion up to QUERY_TIMEOUT_SECONDS; on timeout or failure
# writes an empty result set so the report still renders.
insights_query() {
  local log_group="$1" query="$2" out="$3" query_id status waited=0
  query_id=$(aws logs start-query --log-group-name "$log_group" \
    --start-time "$SINCE_EPOCH" --end-time "$NOW_EPOCH" \
    --query-string "$query" --query queryId --output text 2>"$out.err" || true)
  if [[ -z "$query_id" || "$query_id" == "None" ]]; then
    warning "Logs Insights query on $log_group could not start: $(head -c 200 "$out.err")" >&2
    echo '{"results":[],"status":"Failed"}' >"$out"
    return
  fi
  while true; do
    aws logs get-query-results --query-id "$query_id" --output json >"$out" 2>/dev/null || true
    status=$(jq -r '.status // "Unknown"' "$out")
    case "$status" in
      Complete)
        return
        ;;
      Failed | Cancelled | Timeout | Unknown)
        warning "Logs Insights query on $log_group ended with status $status." >&2
        echo '{"results":[],"status":"'"$status"'"}' >"$out"
        return
        ;;
    esac
    if ((waited >= QUERY_TIMEOUT_SECONDS)); then
      warning "Logs Insights query on $log_group did not finish in ${QUERY_TIMEOUT_SECONDS}s; abandoning it." >&2
      aws logs stop-query --query-id "$query_id" >/dev/null 2>&1 || true
      echo '{"results":[],"status":"Timeout"}' >"$out"
      return
    fi
    sleep 2
    waited=$((waited + 2))
  done
}

# Render a Logs Insights results file as a Markdown table, keeping the column
# order the query produced and dropping the @ptr pointer column.
insights_table() {
  jq -r '
    (.results | map(map(select(.field != "@ptr")))) as $rows
    | if ($rows | length) == 0 then "_No rows._"
      else
        ($rows[0] | map(.field)) as $cols
        | ("| " + ($cols | join(" | ")) + " |"),
          ("| " + ($cols | map("---") | join(" | ")) + " |"),
          ($rows[] | "| " + (map(.value // "" | gsub("\\|"; "\\|") | gsub("\n"; " ")) | join(" | ")) + " |")
      end' "$1"
}

# jq definitions shared by the runs-table renderers. Unmarshals the DynamoDB
# attribute-value JSON the CLI returns into plain values.
JQ_UNMARSHAL='
  def unmarshal:
    if type == "object" then
      if has("S") then .S
      elif has("N") then (.N | tonumber)
      elif has("BOOL") then .BOOL
      elif has("NULL") then null
      elif has("M") then (.M | map_values(unmarshal))
      elif has("L") then (.L | map(unmarshal))
      else map_values(unmarshal) end
    else . end;
  def table($cols):
    if length == 0 then "_No rows._"
    else
      ("| " + ($cols | join(" | ")) + " |"),
      ("| " + ($cols | map("---") | join(" | ")) + " |"),
      (.[] | . as $row | "| " + ([$cols[] | ($row[.] // "") | tostring | gsub("\\|"; "\\|")] | join(" | ")) + " |")
    end;
  def ms_to_s: if . == null then "" else ((. / 100 | round) / 10) end;
  def iso: if . == null then "" else (. / 1000 | floor | todate) end;
'

# --- 1. deployments, capacity and alarm state --------------------------------

info "Reading function configuration and alarm state..." >&2
{
  for fn in "$UI_FUNCTION" "$R_FUNCTION" "$ORCHESTRATOR_FUNCTION"; do
    aws lambda get-function-configuration --function-name "$fn" --output json 2>/dev/null |
      jq --arg fn "$fn" --arg reserved "$(aws lambda get-function-concurrency --function-name "$fn" --query ReservedConcurrentExecutions --output text 2>/dev/null || echo None)" \
        '{function: $fn, lastModified: .LastModified, memoryMb: .MemorySize, timeoutS: .Timeout, reservedConcurrency: $reserved}' ||
      jq -n --arg fn "$fn" '{function: $fn, lastModified: "unavailable", memoryMb: "", timeoutS: "", reservedConcurrency: ""}'
  done
} | jq -s '.' >"$WORK_DIR/functions.json"

aws cloudwatch describe-alarms --alarm-name-prefix "$PROJECT-" --output json 2>/dev/null |
  jq '[.MetricAlarms[] | {alarm: .AlarmName, state: .StateValue, since: .StateUpdatedTimestamp}]' >"$WORK_DIR/alarms.json" || true
[[ -s "$WORK_DIR/alarms.json" ]] || echo '[]' >"$WORK_DIR/alarms.json"

BANNER_STATE=$(aws ssm get-parameter --name "$BANNER_PARAMETER" --query Parameter.Value --output text 2>/dev/null || echo "unavailable")

# --- 2. CloudWatch metrics ---------------------------------------------------

info "Reading CloudWatch metrics..." >&2
{
  for fn in "$UI_FUNCTION" "$R_FUNCTION" "$ORCHESTRATOR_FUNCTION"; do
    jq -n --arg fn "$fn" \
      --arg invocations "$(metric "$fn" Invocations Sum)" \
      --arg errors "$(metric "$fn" Errors Sum)" \
      --arg throttles "$(metric "$fn" Throttles Sum)" \
      --arg avg_ms "$(metric "$fn" Duration Average)" \
      --arg max_ms "$(metric "$fn" Duration Maximum)" \
      --arg concurrency "$(metric "$fn" ConcurrentExecutions Maximum)" \
      '{function: $fn, invocations: ($invocations | tonumber | round), errors: ($errors | tonumber | round),
        throttles: ($throttles | tonumber | round), avgDurationS: (($avg_ms | tonumber) / 1000 * 10 | round / 10),
        maxDurationS: (($max_ms | tonumber) / 1000 * 10 | round / 10), peakConcurrency: ($concurrency | tonumber | round)}'
  done
} | jq -s '.' >"$WORK_DIR/metrics.json"

jq -n \
  --arg requests "$(metric "$UI_FUNCTION" UrlRequestCount Sum)" \
  --arg c4xx "$(metric "$UI_FUNCTION" Url4xxCount Sum)" \
  --arg c5xx "$(metric "$UI_FUNCTION" Url5xxCount Sum)" \
  --arg latency "$(metric "$UI_FUNCTION" UrlRequestLatency Average)" \
  '{requests: ($requests | tonumber | round), status4xx: ($c4xx | tonumber | round), status5xx: ($c5xx | tonumber | round),
    avgLatencyMs: ($latency | tonumber | round)}' >"$WORK_DIR/url.json"

jq -n \
  --argjson ui "$(hourly_metric "$UI_FUNCTION" UrlRequestCount)" \
  --argjson r "$(hourly_metric "$R_FUNCTION" Invocations)" \
  --argjson errors "$(hourly_metric "$R_FUNCTION" Errors)" \
  '($ui + $r + $errors | keys | sort) as $hours
   | [$hours[] | {hour: ., uiRequests: ($ui[.] // 0), rInvocations: ($r[.] // 0), rErrors: ($errors[.] // 0)}]' >"$WORK_DIR/hourly.json"

# --- 3. R backend request log and REPORT lines --------------------------------

R_LOG_GROUP="/aws/lambda/$R_FUNCTION"
info "Running Logs Insights queries on $R_LOG_GROUP..." >&2

REQUEST_FILTER='filter ispresent(outcome) and ispresent(endpoint)'

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| stats count(*) as requests, count_distinct(inputHash) as distinct_inputs,
        sum(strcontains(outcome, \"ok\")) as ok, sum(strcontains(outcome, \"timeout\")) as timeouts,
        sum(strcontains(outcome, \"error\")) as errors" \
  "$WORK_DIR/q_totals.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| stats count(*) as requests, sum(strcontains(outcome, \"ok\")) as ok, sum(strcontains(outcome, \"timeout\")) as timeouts,
        sum(strcontains(outcome, \"error\")) as errors, avg(durationSec) as avg_s, pct(durationSec, 50) as p50_s,
        pct(durationSec, 95) as p95_s, max(durationSec) as max_s by endpoint
| sort requests desc" \
  "$WORK_DIR/q_by_endpoint.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| stats count(*) as requests, sum(strcontains(outcome, \"timeout\")) as timeouts, sum(strcontains(outcome, \"error\")) as errors,
        pct(durationSec, 50) as p50_s, max(durationSec) as max_s by endpoint, method
| sort requests desc" \
  "$WORK_DIR/q_by_method.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| stats count(*) as requests, min(k) as min_k, pct(k, 50) as median_k, avg(k) as avg_k, max(k) as max_k" \
  "$WORK_DIR/q_k.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| fields @timestamp, endpoint, method, k, outcome, durationSec
| sort durationSec desc
| limit 10" \
  "$WORK_DIR/q_slowest.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| filter outcome != \"ok\"
| fields @timestamp, endpoint, method, k, outcome, durationSec, requestId
| sort @timestamp desc
| limit 25" \
  "$WORK_DIR/q_failures.json"

insights_query "$R_LOG_GROUP" "$REQUEST_FILTER
| stats count(*) as requests, sum(strcontains(outcome, \"timeout\")) as timeouts, sum(strcontains(outcome, \"error\")) as errors,
        sum(durationSec) as busy_s by bin(1h)" \
  "$WORK_DIR/q_hourly.json"

# REPORT lines: cold starts and billed compute per function. @billedDuration is
# in ms and @memorySize / @maxMemoryUsed in bytes, so GB-seconds are computed
# from the summed billed seconds and the (constant) memory size.
REPORT_QUERY='filter @type = "REPORT"
| stats count(*) as invocations, sum(strcontains(@message, "Init Duration")) as cold_starts,
        sum(@billedDuration) as billed_ms, max(@memorySize) as memory_bytes, max(@maxMemoryUsed) as peak_memory_bytes'

for fn in "$UI_FUNCTION" "$R_FUNCTION" "$ORCHESTRATOR_FUNCTION"; do
  insights_query "/aws/lambda/$fn" "$REPORT_QUERY" "$WORK_DIR/q_report_$fn.json"
done

{
  for fn in "$UI_FUNCTION" "$R_FUNCTION" "$ORCHESTRATOR_FUNCTION"; do
    jq --arg fn "$fn" '
      (.results[0] // [] | map({(.field): .value}) | add // {}) as $r
      | ($r.billed_ms // "0" | tonumber / 1000) as $billed
      | ($r.memory_bytes // "0" | tonumber / 1048576) as $mem
      | {function: $fn, invocations: ($r.invocations // "0" | tonumber), coldStarts: ($r.cold_starts // "0" | tonumber),
         billedS: ($billed | round), memoryMb: ($mem | round), peakMemoryMb: ($r.peak_memory_bytes // "0" | tonumber / 1048576 | round),
         gbSeconds: ($billed * $mem / 1024 | round)}' "$WORK_DIR/q_report_$fn.json"
  done
} | jq -s '.' >"$WORK_DIR/report_lines.json"

# --- 4. runs table -------------------------------------------------------------

info "Scanning $RUNS_TABLE..." >&2
# Every attribute except the ~50 KB inline result. status, method, k and ttl
# are DynamoDB reserved words, hence the placeholders.
aws dynamodb scan --table-name "$RUNS_TABLE" --output json \
  --projection-expression "jobId, inputHash, endpoint, #s, #k, #m, modelType, sourceJobId, startedAt, finishedAt, submittedAt, runDurationMs, errorCode, errorMessage, runCount, dedupHits" \
  --expression-attribute-names '{"#s":"status","#k":"k","#m":"method"}' 2>"$WORK_DIR/scan.err" |
  jq "$JQ_UNMARSHAL"'[.Items[] | map_values(unmarshal)]' >"$WORK_DIR/runs.json" || true
if [[ ! -s "$WORK_DIR/runs.json" ]]; then
  warning "Could not scan $RUNS_TABLE: $(head -c 200 "$WORK_DIR/scan.err")" >&2
  echo '[]' >"$WORK_DIR/runs.json"
fi

SINCE_MS=$((SINCE_EPOCH * 1000))

# --- render ------------------------------------------------------------------

render() {
  echo "# MAIVE usage report"
  echo
  echo "Window: **$SINCE_ISO** to **$NOW_ISO** (${HOURS} h), region \`$REGION\`, project \`$PROJECT\`."
  echo "Generated by \`scripts/usageReport.sh\` on $NOW_ISO."
  echo
  echo "## Summary"
  echo
  jq -r --argjson url "$(cat "$WORK_DIR/url.json")" --argjson report "$(cat "$WORK_DIR/report_lines.json")" \
    --argjson runs "$(cat "$WORK_DIR/runs.json")" --argjson since "$SINCE_MS" --arg r_fn "$R_FUNCTION" '
    (.results[0] // [] | map({(.field): .value}) | add // {}) as $t
    | ($report | map(.gbSeconds) | add) as $gb
    | ($runs | map(select((.jobId | startswith("input#")) and ((.startedAt // 0) >= $since)))) as $inputs
    | "- UI Function URL requests (pages, assets and API calls): **\($url.requests)**, of which \($url.status4xx) returned 4xx and \($url.status5xx) returned 5xx.",
      "- Model requests reaching the R backend: **\($t.requests // 0)** (\($t.ok // 0) ok, \($t.timeouts // 0) timed out, \($t.errors // 0) errored) on \($t.distinct_inputs // 0) distinct inputs.",
      "- Distinct inputs last run in the window (runs table): **\($inputs | length)**, with \($inputs | map(.dedupHits // 0) | add // 0) deduplicated repeat submissions over their lifetime.",
      "- Billed Lambda compute across the three functions: **\($gb) GB-seconds** (the daily alarm trips at 60,000 per day)."
    ' "$WORK_DIR/q_totals.json"
  echo
  echo "## Deployments, capacity and alarms"
  echo
  echo "Banner parameter \`$BANNER_PARAMETER\`: \`$BANNER_STATE\`."
  echo
  jq -r "$JQ_UNMARSHAL"'table(["function", "lastModified", "memoryMb", "timeoutS", "reservedConcurrency"])' "$WORK_DIR/functions.json"
  echo
  jq -r "$JQ_UNMARSHAL"'length as $n | map(select(.state != "OK"))
    | if length == 0 then "All \($n) `'"$PROJECT"'-*` alarms are in the OK state." else table(["alarm", "state", "since"]) end' \
    "$WORK_DIR/alarms.json"
  echo
  echo "## Lambda metrics"
  echo
  jq -r "$JQ_UNMARSHAL"'table(["function", "invocations", "errors", "throttles", "avgDurationS", "maxDurationS", "peakConcurrency"])' "$WORK_DIR/metrics.json"
  echo
  echo "UI Function URL: average latency $(jq -r '.avgLatencyMs' "$WORK_DIR/url.json") ms."
  echo
  echo "### Cold starts and billed compute (REPORT lines)"
  echo
  jq -r "$JQ_UNMARSHAL"'table(["function", "invocations", "coldStarts", "billedS", "memoryMb", "peakMemoryMb", "gbSeconds"])' "$WORK_DIR/report_lines.json"
  echo
  echo "### Hourly traffic"
  echo
  echo "UI Function URL requests and R backend invocations per hour (UTC). Hours with no traffic are omitted by CloudWatch."
  echo
  jq -r "$JQ_UNMARSHAL"'table(["hour", "uiRequests", "rInvocations", "rErrors"])' "$WORK_DIR/hourly.json"
  echo
  echo "## R backend model requests (request log)"
  echo
  echo "One line per model request from \`request_log.R\`; direct \`/v1\` callers log a null input hash."
  echo
  echo "### By endpoint"
  echo
  insights_table "$WORK_DIR/q_by_endpoint.json"
  echo
  echo "### By endpoint and method"
  echo
  insights_table "$WORK_DIR/q_by_method.json"
  echo
  echo "### Dataset size (rows per request)"
  echo
  insights_table "$WORK_DIR/q_k.json"
  echo
  echo "### Requests per hour"
  echo
  insights_table "$WORK_DIR/q_hourly.json"
  echo
  echo "### Slowest requests"
  echo
  insights_table "$WORK_DIR/q_slowest.json"
  echo
  echo "### Timeouts and errors"
  echo
  insights_table "$WORK_DIR/q_failures.json"
  echo
  echo "## Runs table"
  echo
  echo "Distinct inputs whose latest run started in the window (\`input#\` records, 30 day TTL; counters cover the record's lifetime) and async jobs submitted in it."
  echo
  echo "### Distinct inputs by outcome"
  echo
  jq -r --argjson since "$SINCE_MS" "$JQ_UNMARSHAL"'
    map(select((.jobId | startswith("input#")) and ((.startedAt // 0) >= $since)))
    | group_by(.status) | map({status: .[0].status, inputs: length, runs: (map(.runCount // 1) | add),
        dedupHits: (map(.dedupHits // 0) | add), medianDurationS: (map(.runDurationMs // empty) | sort | if length == 0 then null else .[length / 2 | floor] end | ms_to_s)})
    | sort_by(-.inputs) | table(["status", "inputs", "runs", "dedupHits", "medianDurationS"])' "$WORK_DIR/runs.json"
  echo
  echo "### Distinct inputs by endpoint, model and method"
  echo
  jq -r --argjson since "$SINCE_MS" "$JQ_UNMARSHAL"'
    map(select((.jobId | startswith("input#")) and ((.startedAt // 0) >= $since)))
    | group_by([.endpoint, .modelType, .method, (.sourceJobId == "sync")])
    | map({endpoint: .[0].endpoint, modelType: (.[0].modelType // ""), method: (.[0].method // ""),
        path: (if .[0].sourceJobId == "sync" then "sync" else "async" end), inputs: length,
        medianK: (map(.k // empty) | sort | if length == 0 then "" else .[length / 2 | floor] end), maxK: (map(.k // empty) | max // "")})
    | sort_by(-.inputs) | table(["endpoint", "modelType", "method", "path", "inputs", "medianK", "maxK"])' "$WORK_DIR/runs.json"
  echo
  echo "### Inputs that failed or timed out"
  echo
  jq -r --argjson since "$SINCE_MS" "$JQ_UNMARSHAL"'
    map(select((.jobId | startswith("input#")) and ((.startedAt // 0) >= $since) and (.status == "failed" or .status == "timedout")))
    | sort_by(-(.startedAt // 0))
    | map({startedAt: (.startedAt | iso), endpoint, method: (.method // ""), k: (.k // ""), status,
        durationS: (.runDurationMs | ms_to_s), runs: (.runCount // 1), errorCode: (.errorCode // ""),
        errorMessage: ((.errorMessage // "") | .[0:120])})
    | table(["startedAt", "endpoint", "method", "k", "status", "durationS", "runs", "errorCode", "errorMessage"])' "$WORK_DIR/runs.json"
  echo
  echo "### Async jobs submitted in the window"
  echo
  jq -r --argjson since "$SINCE_MS" "$JQ_UNMARSHAL"'
    map(select((.jobId | startswith("input#") | not) and ((.submittedAt // .startedAt // 0) >= $since)))
    | group_by([.modelType, .status]) | map({modelType: (.[0].modelType // ""), status: .[0].status, jobs: length})
    | sort_by(-.jobs) | table(["modelType", "status", "jobs"])' "$WORK_DIR/runs.json"
}

if [[ -n "$OUT" ]]; then
  render >"$OUT"
  success "Report written to $OUT"
else
  render
fi
