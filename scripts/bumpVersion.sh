#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Check if an argument is provided
if [ $# -eq 0 ]; then
    error "No version type specified. Please specify BUILD, PATCH, MINOR, or MAJOR."
    exit 1
fi

# Check if there are unsaved changes
if [[ $(git status --porcelain) ]]; then
    error "There are unsaved changes. Please commit or stash your changes before running this script."
    exit 1
fi

# Navigate to the project root (one level above SCRIPTS_DIR)
PROJECT_ROOT=$(dirname "$SCRIPTS_DIR")
cd "$PROJECT_ROOT"

# Assign the first argument to a variable
SEMVER_LEVEL=$1

# Check if the version type is valid
if [[ "$SEMVER_LEVEL" != "BUILD" && "$SEMVER_LEVEL" != "PATCH" && "$SEMVER_LEVEL" != "MINOR" && "$SEMVER_LEVEL" != "MAJOR" ]]; then
    error "Invalid version type: $SEMVER_LEVEL. Please specify BUILD, PATCH, MINOR, or MAJOR."
    exit 1
fi

# Execute the version bump command
NEW_VERSION=$(node ./.github/libs/bumpVersion.js --semver $SEMVER_LEVEL)

# Use the NEW_VERSION variable in subsequent commands
info "The new version is $NEW_VERSION"

git add .
git commit -m "build: version update: $NEW_VERSION"

success "Version update complete!"
success "Please push your changes to the remote repository using 'git push'."
