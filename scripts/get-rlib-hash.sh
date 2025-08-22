#!/usr/bin/env bash

set -euo pipefail

MAIVE_TAG="${1:?MAIVE_TAG missing}"

HASH_TAG="$(sha256sum apps/lambda-r-backend/r_scripts/r-packages.txt | awk '{print substr($1,1,8)}')_${MAIVE_TAG}"

echo $HASH_TAG