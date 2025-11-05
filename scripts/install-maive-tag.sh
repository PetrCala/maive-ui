#!/usr/bin/env bash

set -euo pipefail

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

OWNER_REPO="PetrCala/MAIVE"

usage() {
    cat <<EOF
Usage: $0 [-h | --help] <MAIVE_TAG>

Options:
    -h, --help     Show this help message and exit
EOF
    exit 1
}

MAIVE_TAG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
    -h | --help)
        usage
        ;;
    *)
        MAIVE_TAG="$1"
        shift
    esac
done

if [[ -z "$MAIVE_TAG" ]]; then
    error "MAIVE_TAG is required"
    usage
fi

if ! gh api repos/$OWNER_REPO/git/refs/tags/$MAIVE_TAG | jq -r '.ref' | grep -Fxq "refs/tags/$MAIVE_TAG"; then
    error "The tag $MAIVE_TAG does not exist in the GitHub repository $OWNER_REPO"
    exit 1
fi

Rscript -e "pak::pkg_install('PetrCala/MAIVE@${MAIVE_TAG}')"

success "MAIVE tag $MAIVE_TAG installation complete."

exit 0
