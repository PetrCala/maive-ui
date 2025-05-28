#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

REVIEWER="PetrCala"

usage() {
  echo "Usage: $0 --semver <SEMVER_LEVEL>"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  --semver)
    SEMVER_LEVEL="$2"
    shift 2
    ;;
  *)
    usage
    ;;
  esac
done

if [ -z "$SEMVER_LEVEL" ]; then
  error "The --semver argument is required. Must be one of {BUILD, PATCH, MINOR, MAJOR}."
  usage
fi

if [[ $(git status --porcelain) ]]; then
  error "There are unsaved changes. Please commit or stash your changes before running this script."
  exit 1
fi

RELEASE_BRANCH="release"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" != "master" ]]; then
  error "You are not on the master branch. Please switch to the master branch before running this script."
  exit 1
fi

info "Opening release PR from branch $CURRENT_BRANCH to branch $RELEASE_BRANCH..."

RELEASE_VERSION=$(jq -r .version 'package.json')
SEMVER_LEVEL=$(echo "$SEMVER_LEVEL" | tr '[:upper:]' '[:lower:]') # to lowercase

gh pr create \
  --title "New version release" \
  --body "" \
  --base $RELEASE_BRANCH \
  --head $CURRENT_BRANCH \
  --reviewer $REVIEWER \
  --label "v-$SEMVER_LEVEL" \
  --label "release"

success "Release PR opened!"
