#!/usr/bin/env bash

set -euo pipefail

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

OWNER_REPO="PetrCala/MAIVE"
WORKFLOW_FILE=".github/workflows/release.yml"

if [[ ! -f "$WORKFLOW_FILE" ]]; then
    error "The $WORKFLOW_FILE file does not exist"
    exit 1
fi

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

# Validate the existence of the MAIVE_TAG
if ! gh api repos/$OWNER_REPO/git/refs/tags/$MAIVE_TAG | jq -r '.ref' | grep -Fxq "refs/tags/$MAIVE_TAG"; then
    error "The tag $MAIVE_TAG does not exist in the GitHub repository $OWNER_REPO"
    exit 1
fi


sed -i.bak "s/^\([[:space:]]*MAIVE_TAG:\).*/\1 $MAIVE_TAG/" $WORKFLOW_FILE


# Verify that th desired tag exists in the file
if ! grep -q "MAIVE_TAG: $MAIVE_TAG" "$WORKFLOW_FILE"; then
    error "Failed to update the MAIVE_TAG in the $WORKFLOW_FILE file"
    exit 1
fi

git add "$WORKFLOW_FILE"
git commit -m "build: update the MAIVE version to $MAIVE_TAG"

success "MAIVE_TAG $MAIVE_TAG is now used in the project. Please push your changes to the remote repository using 'git push'."

exit 0