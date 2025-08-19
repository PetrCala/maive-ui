#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Test script for quarterly release logic
# This script simulates the quarterly release workflow locally
# without actually creating branches or PRs

usage() {
  echo "Usage: $0 [--quarter Q1|Q2|Q3|Q4] [--year YYYY] [--test-version]"
  echo ""
  echo "Options:"
  echo "  --quarter    Specify quarter to test (default: current quarter)"
  echo "  --year       Specify year to test (default: current year)"
  echo "  --test-version  Test version bumping logic"
  echo "  --help       Show this help message"
  exit 1
}

# Default values
TEST_QUARTER=""
TEST_YEAR=""
TEST_VERSION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --quarter)
      TEST_QUARTER="$2"
      shift 2
      ;;
    --year)
      TEST_YEAR="$2"
      shift 2
      ;;
    --test-version)
      TEST_VERSION=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

# Function to determine quarter and year
determine_quarter_info() {
  local current_date=$(date -u +%Y-%m-%d)
  local year=${TEST_YEAR:-$(date -u +%Y)}
  
  # Determine quarter based on month
  local month=$(date -u +%m)
  local quarter=""
  local quarter_name=""
  
  if [ "$month" -eq 01 ]; then
    quarter="Q1"
    quarter_name="First Quarter"
  elif [ "$month" -eq 04 ]; then
    quarter="Q2"
    quarter_name="Second Quarter"
  elif [ "$month" -eq 07 ]; then
    quarter="Q3"
    quarter_name="Third Quarter"
  elif [ "$month" -eq 10 ]; then
    quarter="Q4"
    quarter_name="Fourth Quarter"
  fi
  
  # Override with test values if provided
  if [ -n "$TEST_QUARTER" ]; then
    quarter="$TEST_QUARTER"
    case "$TEST_QUARTER" in
      "Q1") quarter_name="First Quarter" ;;
      "Q2") quarter_name="Second Quarter" ;;
      "Q3") quarter_name="Third Quarter" ;;
      "Q4") quarter_name="Fourth Quarter" ;;
      *) error "Invalid quarter: $TEST_QUARTER. Use Q1, Q2, Q3, or Q4."; exit 1 ;;
    esac
  fi
  
  echo "QUARTER=$quarter"
  echo "QUARTER_NAME=$quarter_name"
  echo "YEAR=$year"
  echo "CURRENT_DATE=$current_date"
}

# Function to test version bumping
test_version_bump() {
  info "Testing version bump logic..."
  
  if [ ! -f "package.json" ]; then
    error "package.json not found. Run this script from the repository root."
    exit 1
  fi
  
  local current_version=$(jq -r .version 'package.json')
  info "Current version: $current_version"
  
  # Test patch increment
  local new_version=$(echo "$current_version" | awk -F. -v OFS=. '{$NF = $NF + 1;} 1')
  info "New version (patch): $new_version"
  
  # Test minor increment (for demonstration)
  local minor_version=$(echo "$current_version" | awk -F. -v OFS=. '{$(NF-1) = $(NF-1) + 1; $NF = 0;} 1')
  info "New version (minor): $minor_version"
  
  # Test major increment (for demonstration)
  local major_version=$(echo "$current_version" | awk -F. -v OFS=. '{$(NF-2) = $(NF-2) + 1; $(NF-1) = 0; $NF = 0;} 1')
  info "New version (major): $major_version"
  
  success "Version bump logic test completed"
}

# Function to simulate PR creation
simulate_pr_creation() {
  local quarter_info
  quarter_info=$(determine_quarter_info)
  
  # Parse the output
  local quarter=$(echo "$quarter_info" | grep "QUARTER=" | cut -d'=' -f2)
  local quarter_name=$(echo "$quarter_info" | grep "QUARTER_NAME=" | cut -d'=' -f2)
  local year=$(echo "$quarter_info" | grep "YEAR=" | cut -d'=' -f2)
  local current_date=$(echo "$quarter_info" | grep "CURRENT_DATE=" | cut -d'=' -f2)
  
  info "Simulating PR creation for $year $quarter_name ($quarter)"
  info "Date: $current_date"
  
  # Simulate branch name
  local branch_name="quarterly-release/$year-$quarter"
  info "Branch name: $branch_name"
  
  # Simulate PR title
  local pr_title="$year $quarter_name Release"
  info "PR title: $pr_title"
  
  # Check if branch would already exist
  if git show-ref --verify --quiet "refs/remotes/origin/$branch_name" 2>/dev/null; then
    warning "Branch $branch_name already exists (this would prevent PR creation)"
  else
    success "Branch $branch_name would be created successfully"
  fi
  
  # Check if PR with similar title exists
  if command -v gh >/dev/null 2>&1; then
    local existing_pr=$(gh pr list --search "title:\"$pr_title\"" --json number,title,state --jq '.[0].number // empty' 2>/dev/null || echo "")
    if [ -n "$existing_pr" ]; then
      warning "PR with similar title already exists: #$existing_pr"
    else
      success "No conflicting PR titles found"
    fi
  else
    info "GitHub CLI not available, skipping PR title conflict check"
  fi
}

# Function to show workflow summary
show_workflow_summary() {
  info "=== Quarterly Release Workflow Summary ==="
  
  local quarter_info
  quarter_info=$(determine_quarter_info)
  
  local quarter=$(echo "$quarter_info" | grep "QUARTER=" | cut -d'=' -f2)
  local quarter_name=$(echo "$quarter_info" | grep "QUARTER_NAME=" | cut -d'=' -f2)
  local year=$(echo "$quarter_info" | grep "YEAR=" | cut -d'=' -f2)
  
  echo ""
  echo "📅 Next quarterly release:"
  echo "   Quarter: $quarter_name ($quarter)"
  echo "   Year: $year"
  echo "   Schedule: First day of quarter at 9:00 AM UTC"
  echo ""
  echo "🔄 Workflow will:"
  echo "   1. Create branch: quarterly-release/$year-$quarter"
  echo "   2. Bump version (patch increment)"
  echo "   3. Create PR with comprehensive instructions"
  echo "   4. Assign to maintainer for review"
  echo ""
  echo "✅ After merge:"
  echo "   - Existing release pipeline triggers automatically"
  echo "   - Deployment runs in production"
  echo "   - Remember to git pull origin master"
  echo ""
}

# Main execution
main() {
  info "Starting quarterly release workflow test..."
  
  # Check if we're in a git repository
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository. Run this script from the repository root."
    exit 1
  fi
  
  # Check if we're on master branch
  local current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$current_branch" != "master" ]; then
    warning "Not on master branch (currently on $current_branch)"
    warning "Some checks may not work correctly"
  fi
  
  echo ""
  
  # Show workflow summary
  show_workflow_summary
  
  # Simulate PR creation
  simulate_pr_creation
  
  echo ""
  
  # Test version bumping if requested
  if [ "$TEST_VERSION" = true ]; then
    echo ""
    test_version_bump
  fi
  
  echo ""
  success "Quarterly release workflow test completed successfully!"
  
  echo ""
  info "To test the actual workflow:"
  echo "1. Go to Actions tab in your GitHub repository"
  echo "2. Select 'Quarterly Release Automation'"
  echo "3. Click 'Run workflow'"
  echo "4. Choose 'Run workflow'"
}

# Run main function
main "$@"
