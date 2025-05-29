#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

REVIEWER="PetrCala"

usage() {
  echo "Usage: $0  [-r | --release] --semver <SEMVER_LEVEL>"
  exit 1
}

READY_TO_BUILD=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  --semver)
    SEMVER_LEVEL="$2"
    shift 2
    ;;
  -r | --release)
    READY_TO_BUILD="true"
    shift
    ;;
  *)
    usage
    ;;
  esac
done

if [ -z "$SEMVER_LEVEL" ]; then
  SEMVER_LEVEL="build"
fi

if [[ $(git status --porcelain) ]]; then
  error "There are unsaved changes. Please commit or stash your changes before running this script."
  exit 1
fi

RELEASE_BRANCH="master"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" == "$RELEASE_BRANCH" ]]; then
  error "You are already on the $RELEASE_BRANCH branch. Please switch to another branch before running this script."
  exit 1
fi

info "Opening PR from branch $CURRENT_BRANCH to branch $RELEASE_BRANCH..."

RELEASE_VERSION=$(jq -r .version 'package.json')
SEMVER_LEVEL=$(echo "$SEMVER_LEVEL" | tr '[:upper:]' '[:lower:]') # to lowercase

gh pr create \
  --title "New version release" \
  --body "Automated release PR" \
  --base "$RELEASE_BRANCH" \
  --head "$CURRENT_BRANCH" \
  --reviewer "$REVIEWER" \
  ${READY_TO_BUILD:+--label release} \
  --label "v-$SEMVER_LEVEL"

success "Release PR opened!"
