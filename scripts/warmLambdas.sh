#!/bin/bash
set -eo pipefail

# Pre-warm the MAIVE Lambdas before a demo or talk.
#
# Invokes the R backend and the UI Lambda directly (lambda:InvokeFunction, so
# no SigV4 signing and no Cloudflare in the way) with N concurrent GET requests
# shaped like Function URL events, which the Lambda Web Adapter in both images
# accepts. A request that arrives while every existing container is busy starts
# a new one. The R requests go to /warmup, which holds its container for a few
# seconds, so the N requests overlap and land on N separate containers instead
# of queueing behind one that is already warm. The UI has no such route (it is
# public, so a route that pins instances would be an abuse vector), so its
# warm-up is best effort; its cold start is only ~1.2 s anyway. Each
# invocation's REPORT line says whether it paid a cold start ("Init Duration"),
# which is what the summary counts.
#
# Lambda reclaims idle containers after several minutes, so run this about 10
# minutes before the session, and again after a long gap.

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
# shellcheck source=scripts/shellUtils.sh
source "$SCRIPTS_DIR/shellUtils.sh"

PROFILE="${AWS_PROFILE:-kiroku}"
REGION="eu-central-1"
PROJECT="maive"
R_COUNT=15
UI_COUNT=20
# How long each R warm-up request holds its container. Long enough to cover
# the spread of N aws CLI processes starting on one machine.
HOLD_SECONDS=3
# Slots left free on each function so live traffic isn't throttled while the
# warm-up requests hold them.
HEADROOM=2
# The kill switch's degraded reserved concurrency
# (cost_circuit_breaker_degraded_concurrency).
DEGRADED_CONCURRENCY=2

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --r <n>             R backend containers to warm (default: $R_COUNT)"
  echo "  --ui <n>            Concurrent UI requests to send (default: $UI_COUNT)"
  echo "  --profile <profile> AWS profile to use (default: \$AWS_PROFILE or kiroku)"
  echo "  --region <region>   AWS region (default: $REGION)"
  echo "  --help              Show this help message"
  echo ""
  echo "Each count is capped at the function's reserved concurrency minus $HEADROOM."
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --r)
      R_COUNT="$2"
      shift 2
      ;;
    --ui)
      UI_COUNT="$2"
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

export AWS_PROFILE="$PROFILE"
export AWS_REGION="$REGION"
R_FUNCTION="$PROJECT-lambda-r-backend"
UI_FUNCTION="$PROJECT-ui"

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  error "AWS CLI is not authenticated with profile $PROFILE."
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# Function URL (payload v2) event for a GET on PATH with an optional raw query
# string QUERY and its parsed form QUERY_JSON (a JSON object).
url_event() {
  local path="$1" query="$2" query_json="$3" query_params=""
  if [[ -n "$query_json" ]]; then
    query_params=",\"queryStringParameters\":$query_json"
  fi
  # shellcheck disable=SC2016 # "$default" is a literal Function URL route key.
  printf '{"version":"2.0","routeKey":"$default","rawPath":"%s","rawQueryString":"%s"%s,"headers":{"host":"warmup.invalid","user-agent":"maive-warmup"},"requestContext":{"accountId":"anonymous","apiId":"warmup","domainName":"warmup.invalid","domainPrefix":"warmup","http":{"method":"GET","path":"%s","protocol":"HTTP/1.1","sourceIp":"127.0.0.1","userAgent":"maive-warmup"},"requestId":"warmup","routeKey":"$default","stage":"$default","time":"01/Jan/2026:00:00:00 +0000","timeEpoch":0},"isBase64Encoded":false}' \
    "$path" "$query" "$query_params" "$path"
}

# Invoke FUNCTION with EVENT, writing the response payload to OUT.json, the
# base64 tail log to OUT.log and CLI errors to OUT.err.
invoke() {
  local function_name="$1" event="$2" out="$3"
  aws lambda invoke --function-name "$function_name" \
    --cli-binary-format raw-in-base64-out --payload "$event" \
    --log-type Tail --query LogResult --output text \
    "$out.json" >"$out.log" 2>"$out.err"
}

status_code() {
  grep -o '"statusCode":[0-9]*' "$1" 2>/dev/null | cut -d: -f2 || true
}

reserved_concurrency() {
  aws lambda get-function-concurrency --function-name "$1" \
    --query ReservedConcurrentExecutions --output text
}

# Cap a requested count at the function's reserved concurrency minus HEADROOM.
capped_count() {
  local function_name="$1" requested="$2" reserved limit
  reserved=$(reserved_concurrency "$function_name")
  if [[ "$reserved" == "None" ]]; then
    echo "$requested"
    return
  fi
  limit=$((reserved - HEADROOM))
  if ((limit < 1)); then
    limit=1
  fi
  if ((requested > limit)); then
    info "$function_name: reserved concurrency is $reserved, so warming $limit instead of $requested." >&2
    echo "$limit"
  else
    echo "$requested"
  fi
}

preflight() {
  local banner reserved alarms
  banner=$(aws ssm get-parameter --name "/$PROJECT/ui/unstable_banner_enabled" \
    --query Parameter.Value --output text 2>/dev/null || echo "unknown")
  reserved=$(reserved_concurrency "$R_FUNCTION")
  alarms=$(aws cloudwatch describe-alarms --alarm-name-prefix "$PROJECT-" \
    --state-value ALARM --query 'MetricAlarms[].AlarmName' --output text)

  info "Unstable banner enabled: $banner"
  info "$R_FUNCTION reserved concurrency: $reserved"

  if [[ -n "$alarms" && "$alarms" != "None" ]]; then
    error "Alarms firing: $alarms"
  else
    success "No alarms firing"
  fi

  if [[ "$banner" == "true" ]] || { [[ "$reserved" =~ ^[0-9]+$ ]] && ((reserved <= DEGRADED_CONCURRENCY)); }; then
    error "The circuit breaker looks tripped. Restore capacity with 'terragrunt apply' in terraform/stacks/prod-runtime (docs/COST_CONTROLS.md), then rerun this script."
  fi
}

# Send COUNT concurrent copies of EVENT to FUNCTION and summarize what they hit.
warm() {
  local function_name="$1" event="$2" count="$3" note="$4"
  local i status report cold=0 reused=0 failed=0 first_failed="" inits="" summary range

  for ((i = 1; i <= count; i++)); do
    invoke "$function_name" "$event" "$WORK_DIR/$function_name-$i" &
  done
  wait

  for ((i = 1; i <= count; i++)); do
    status=$(status_code "$WORK_DIR/$function_name-$i.json")
    if [[ "$status" != "200" ]]; then
      failed=$((failed + 1))
      first_failed="${first_failed:-$i}"
      continue
    fi
    report=$(base64 --decode <"$WORK_DIR/$function_name-$i.log" 2>/dev/null | grep '^REPORT' || true)
    if [[ "$report" == *"Init Duration"* ]]; then
      cold=$((cold + 1))
      inits="$inits $(sed -E 's/.*Init Duration: ([0-9.]+) ms.*/\1/' <<<"$report")"
    else
      reused=$((reused + 1))
    fi
  done

  summary="$function_name: $cold new containers started, $reused requests landed on containers already warm"
  if ((cold > 0)); then
    range=$(tr ' ' '\n' <<<"$inits" | grep . | sort -n |
      awk 'NR == 1 { min = $1 } { max = $1 } END { printf "%.1f to %.1f s", min / 1000, max / 1000 }')
    summary="$summary (cold start $range)"
  fi

  if ((failed > 0)); then
    error "$summary, $failed failed. First failure:"
    cat "$WORK_DIR/$function_name-$first_failed.err" 2>/dev/null
    head -c 300 "$WORK_DIR/$function_name-$first_failed.json" 2>/dev/null
    echo
  else
    success "$summary"
    if [[ -n "$note" ]]; then
      info "  $note"
    fi
  fi
}

title "Preflight"
preflight

title "Warming"
R_COUNT=$(capped_count "$R_FUNCTION" "$R_COUNT")
UI_COUNT=$(capped_count "$UI_FUNCTION" "$UI_COUNT")

# Images built before /warmup existed answer it with a 404; fall back to /ping,
# which can't hold a container, so fewer separate containers may get warmed.
invoke "$R_FUNCTION" "$(url_event /warmup "seconds=0" '{"seconds":"0"}')" "$WORK_DIR/probe"
if [[ "$(status_code "$WORK_DIR/probe.json")" == "200" ]]; then
  R_EVENT=$(url_event /warmup "seconds=$HOLD_SECONDS" "{\"seconds\":\"$HOLD_SECONDS\"}")
  R_NOTE="Each request held its container for ${HOLD_SECONDS} s, so these are $R_COUNT separate warm containers."
else
  info "$R_FUNCTION has no /warmup route yet (deployed before it was added); using /ping, which may warm fewer containers."
  R_EVENT=$(url_event /ping "" "")
  R_NOTE=""
fi

info "Sending $R_COUNT concurrent requests to $R_FUNCTION and $UI_COUNT to $UI_FUNCTION..."
warm "$R_FUNCTION" "$R_EVENT" "$R_COUNT" "$R_NOTE" &
warm "$UI_FUNCTION" "$(url_event / "" "")" "$UI_COUNT" "" &
wait

info "Idle containers stay warm for several minutes. Rerun this if the session starts much later."
