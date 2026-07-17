#!/usr/bin/env bash
# Deploy a Cloudflare Worker from infra/cloudflare/workers/ to the account that
# owns maive.eu.
#
# Cloudflare is not managed by Terraform (see README.md), so this script is the
# reproducible path for worker changes. Routes, DNS, and rate-limit rules are
# documented in README.md and change rarely enough to be done in the dashboard.
#
# Auth: expects a scoped API token with Account:Workers Scripts:Edit, either in
# $CLOUDFLARE_API_TOKEN or in the file below. The token is never echoed.
#
# Usage:
#   bash infra/cloudflare/deploy-worker.sh api-origin-proxy
#   bash infra/cloudflare/deploy-worker.sh ui-origin-proxy
set -euo pipefail

SCRIPT_NAME="${1:-}"
if [ -z "$SCRIPT_NAME" ]; then
  echo "Usage: $0 <worker-name>   (e.g. api-origin-proxy)" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/workers/$SCRIPT_NAME.js"
if [ ! -f "$SRC" ]; then
  echo "No such worker source: $SRC" >&2
  exit 1
fi

# Account that owns the maive.eu zone (see README.md).
ACCOUNT_ID="e3f44e904f9ace6427b6a47cb28a3917"
API="https://api.cloudflare.com/client/v4"
TOKEN_FILE="${CLOUDFLARE_TOKEN_FILE:-$HOME/.config/cloudflare/maive_token}"
COMPAT_DATE="2026-07-08"

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  TOKEN="$CLOUDFLARE_API_TOKEN"
elif [ -s "$TOKEN_FILE" ]; then
  TOKEN="$(cat "$TOKEN_FILE")"
else
  echo "No token: set \$CLOUDFLARE_API_TOKEN or write one to $TOKEN_FILE" >&2
  exit 1
fi

echo "Deploying $SCRIPT_NAME from $SRC ..."
response="$(curl -sS -X PUT "$API/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME" \
  -H "Authorization: Bearer $TOKEN" \
  -F "metadata={\"main_module\":\"worker.js\",\"compatibility_date\":\"$COMPAT_DATE\"};type=application/json" \
  -F "worker.js=@$SRC;type=application/javascript+module;filename=worker.js")"

if printf '%s' "$response" | grep -q '"success":true'; then
  echo "Deployed $SCRIPT_NAME."
  echo "Verify: curl -s https://api.maive.eu/v1/health"
else
  echo "Deploy failed:" >&2
  printf '%s\n' "$response" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$response"
  exit 1
fi
