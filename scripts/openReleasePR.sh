#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

REVIEWER="PetrCala"

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

gh pr create \
  --title "Release v$RELEASE_VERSION" \
  --body "Release v$RELEASE_VERSION" \
  --base $RELEASE_BRANCH \
  --head $CURRENT_BRANCH \
  --reviewer $REVIEWER \
  --label "release"

success "Release PR opened!"
