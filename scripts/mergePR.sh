#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Configuration
REPO_OWNER="PetrCala"
REPO_NAME="maive-ui"
MASTER_BRANCH="master"
DEFAULT_WAIT_FOR_RELEASE=true

usage() {
  echo "Usage: $0 [OPTIONS] [PR_NUMBER]"
  echo ""
  echo "Options:"
  echo "  --no-wait-release    Skip waiting for release workflow completion"
  echo "  --admin              Use admin privileges for merging (original behavior)"
  echo "  --help               Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 123               # Merge PR 123 and wait for release if it's a release PR"
  echo "  $0 --no-wait-release 123  # Merge PR 123 without waiting for release"
  echo "  $0 --admin           # Merge current branch PR with admin privileges (original behavior)"
  echo ""
  exit 1
}

# Parse arguments
WAIT_FOR_RELEASE=$DEFAULT_WAIT_FOR_RELEASE
ADMIN_MODE=false
PR_NUMBER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-wait-release)
      WAIT_FOR_RELEASE=false
      shift
      ;;
    --admin)
      ADMIN_MODE=true
      shift
      ;;
    --help)
      usage
      ;;
    -*)
      error "Unknown option: $1"
      usage
      ;;
    *)
      if [[ -z "$PR_NUMBER" ]]; then
        PR_NUMBER="$1"
      else
        error "Multiple PR numbers specified. Please provide only one."
        usage
      fi
      shift
      ;;
  esac
done

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  error "GitHub CLI (gh) is not installed. Please install it first."
  exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
  error "Not authenticated with GitHub CLI. Please run 'gh auth login' first."
  exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  error "jq is not installed. Please install it first."
  exit 1
fi

# Handle admin mode (original behavior)
if [[ "$ADMIN_MODE" == "true" ]]; then
  info "Using admin mode - merging current branch PR..."
  gh pr merge --rebase --delete-branch --admin
  exit 0
fi

# If no PR number provided, try to find the current branch's PR
if [[ -z "$PR_NUMBER" ]]; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$CURRENT_BRANCH" == "$MASTER_BRANCH" ]]; then
    error "You are on the $MASTER_BRANCH branch. Please switch to a feature branch or provide a PR number."
    usage
  fi
  
  # Try to find PR for current branch
  PR_INFO=$(gh pr view --json number,title,state 2>/dev/null)
  if [[ $? -eq 0 ]]; then
    PR_NUMBER=$(echo "$PR_INFO" | jq -r '.number')
    PR_STATE=$(echo "$PR_INFO" | jq -r '.state')
    
    if [[ "$PR_STATE" == "MERGED" ]]; then
      info "PR for current branch is already merged."
      exit 0
    fi
    
    info "Found PR #$PR_NUMBER for current branch $CURRENT_BRANCH"
  else
    error "No PR found for current branch $CURRENT_BRANCH. Please provide a PR number or create a PR first."
    usage
  fi
fi

# Validate PR number
if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  error "Invalid PR number: $PR_NUMBER"
  exit 1
fi

info "Processing PR #$PR_NUMBER..."

# Get PR details
PR_INFO=$(gh pr view "$PR_NUMBER" --json labels,title,headRefName,baseRefName,state,merged 2>/dev/null)
if [[ $? -ne 0 ]]; then
  error "Failed to fetch PR information. Check if PR #$PR_NUMBER exists and you have access."
  exit 1
fi

# Check if PR is already merged
PR_STATE=$(echo "$PR_INFO" | jq -r '.state')
if [[ "$PR_STATE" == "MERGED" ]]; then
  info "PR #$PR_NUMBER is already merged."
else
  # Check if PR is mergeable
  MERGEABLE=$(gh pr view "$PR_NUMBER" --json mergeable 2>/dev/null)
  if [[ $? -ne 0 ]]; then
    error "Failed to check PR mergeability."
    exit 1
  fi
  
  MERGE_STATUS=$(echo "$MERGEABLE" | jq -r '.mergeable')
  
  if [[ "$MERGE_STATUS" == "CONFLICTING" ]]; then
    error "PR #$PR_NUMBER has merge conflicts. Please resolve them first."
    exit 1
  fi
  
  if [[ "$MERGE_STATUS" == "BLOCKED" ]]; then
    error "PR #$PR_NUMBER is blocked. Please check the requirements."
    exit 1
  fi
  
  # Merge the PR
  info "Merging PR #$PR_NUMBER..."
  gh pr merge "$PR_NUMBER" --rebase --delete-branch
  
  if [[ $? -eq 0 ]]; then
    success "PR #$PR_NUMBER merged successfully!"
  else
    error "Failed to merge PR #$PR_NUMBER"
    exit 1
  fi
fi

# Check if this is a release PR
HAS_RELEASE_LABEL=$(echo "$PR_INFO" | jq -r '.labels[] | select(.name == "release") | .name' 2>/dev/null || echo "")
if [[ "$HAS_RELEASE_LABEL" == "release" ]]; then
  info "This is a release PR. Monitoring release workflow..."
  
  if [[ "$WAIT_FOR_RELEASE" == "false" ]]; then
    info "Skipping release workflow monitoring (--no-wait-release specified)"
    exit 0
  fi
  
  # Wait for the bumpVersion job to complete
  wait_for_version_update
  
else
  info "This is not a release PR. No further action needed."
  exit 0
fi

# Function to wait for version update
wait_for_version_update() {
  info "Waiting for version update to complete..."
  
  # Get current version before waiting
  CURRENT_VERSION=$(jq -r .version 'package.json' 2>/dev/null || echo "unknown")
  info "Current version: $CURRENT_VERSION"
  
  # Wait for version to change or workflow to fail
  MAX_WAIT_TIME=300  # 5 minutes
  WAIT_INTERVAL=10   # Check every 10 seconds
  ELAPSED_TIME=0
  
  while [[ $ELAPSED_TIME -lt $MAX_WAIT_TIME ]]; do
    # Pull latest changes
    git fetch origin "$MASTER_BRANCH" >/dev/null 2>&1
    
    # Check if there are new commits
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git rev-parse "origin/$MASTER_BRANCH" 2>/dev/null || echo "")
    
    if [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" && -n "$LOCAL_COMMIT" && -n "$REMOTE_COMMIT" ]]; then
      # Pull the changes
      git pull origin "$MASTER_BRANCH" >/dev/null 2>&1
      
      # Check if version changed
      NEW_VERSION=$(jq -r .version 'package.json' 2>/dev/null || echo "")
      if [[ "$NEW_VERSION" != "$CURRENT_VERSION" && -n "$NEW_VERSION" ]]; then
        success "Version updated successfully from $CURRENT_VERSION to $NEW_VERSION!"
        return 0
      fi
    fi
    
    # Check workflow status
    WORKFLOW_STATUS=$(gh run list --limit 1 --json status,conclusion,headSha 2>/dev/null || echo "[]")
    LATEST_RUN=$(echo "$WORKFLOW_STATUS" | jq -r '.[0]')
    
    if [[ "$LATEST_RUN" != "null" && "$LATEST_RUN" != "" ]]; then
      RUN_STATUS=$(echo "$LATEST_RUN" | jq -r '.status')
      RUN_CONCLUSION=$(echo "$LATEST_RUN" | jq -r '.conclusion')
      
      if [[ "$RUN_STATUS" == "completed" ]]; then
        if [[ "$RUN_CONCLUSION" == "success" ]]; then
          success "Release workflow completed successfully!"
          return 0
        elif [[ "$RUN_CONCLUSION" == "failure" ]]; then
          error "Release workflow failed!"
          return 1
        elif [[ "$RUN_CONCLUSION" == "cancelled" ]]; then
          error "Release workflow was cancelled!"
          return 1
        fi
      fi
    fi
    
    # Wait and continue
    sleep $WAIT_INTERVAL
    ELAPSED_TIME=$((ELAPSED_TIME + WAIT_INTERVAL))
    
    # Show progress
    REMAINING=$((MAX_WAIT_TIME - ELAPSED_TIME))
    info "Waiting... ($REMAINING seconds remaining)"
  done
  
  # Timeout reached
  error "Timeout waiting for version update. The workflow may still be running."
  info "You can check the workflow status manually with: gh run list"
  return 1
}
