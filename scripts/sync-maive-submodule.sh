#!/bin/bash

# Sync the maive submodule with its upstream remote

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
SUBMODULE_PATH="lambda-r-backend/vendor/maive"
UTILS_PATH="$SCRIPT_DIR/shellUtils.sh"

# Source shell utils for logging
if [ -f "$UTILS_PATH" ]; then
  source "$UTILS_PATH"
else
  echo "shellUtils.sh not found in $SCRIPT_DIR. Exiting."
  exit 1
fi

cd "$PROJECT_ROOT"

if [ ! -d "$SUBMODULE_PATH/.git" ] && [ ! -f "$SUBMODULE_PATH/.git" ]; then
  error "Submodule directory $SUBMODULE_PATH does not exist or is not initialized."
  exit 1
fi

info "Syncing submodule at $SUBMODULE_PATH"
cd "$SUBMODULE_PATH"

# Check if 'upstream' remote exists
git remote get-url upstream &>/dev/null
if [ $? -eq 0 ]; then
  info "Fetching from upstream remote..."
  git fetch upstream
  info "Merging upstream/main into current branch..."
  git merge upstream/main || {
    error "Merge failed. Please resolve conflicts manually."
    exit 1
  }
  success "Submodule synchronized with upstream."
else
  error "No 'upstream' remote found for submodule. Please add it with: git remote add upstream <url>"
  exit 1
fi
