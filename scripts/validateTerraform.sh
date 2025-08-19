#!/bin/bash
set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Configuration
FOUNDATION_DIR="terraform/stacks/prod-foundation"
RUNTIME_DIR="terraform/stacks/prod-runtime"
PROJECT_NAME="maive"
DEFAULT_EMAIL="test@examle.com"

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --email <email>     Admin email for Terraform variables (default: $DEFAULT_EMAIL)"
  echo "  --image-tag <tag>   Docker image tag for validation (default: test)"
  echo "  --profile <profile> AWS profile to use (default: kiroku)"
  echo "  --foundation-only   Validate only the foundation stack"
  echo "  --runtime-only      Validate only the runtime stack"
  echo "  --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                    # Validate both stacks"
  echo "  $0 --foundation-only  # Validate only foundation"
  echo "  $0 --runtime-only     # Validate only runtime"
  echo "  $0 --email user@example.com --image-tag latest"
  echo ""
  exit 1
}

# Parse arguments
EMAIL="$DEFAULT_EMAIL"
IMAGE_TAG="test"
AWS_PROFILE="kiroku"
VALIDATE_FOUNDATION=true
VALIDATE_RUNTIME=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --profile)
      AWS_PROFILE="$2"
      shift 2
      ;;
    --foundation-only)
      VALIDATE_FOUNDATION=true
      VALIDATE_RUNTIME=false
      shift
      ;;
    --runtime-only)
      VALIDATE_FOUNDATION=false
      VALIDATE_RUNTIME=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      error "Unknown option: $1"
      usage
      ;;
  esac
done

# Check if required tools are available
if ! command -v aws &> /dev/null; then
  error "AWS CLI is not installed. Please install it first."
  exit 1
fi

if ! command -v terragrunt &> /dev/null; then
  error "Terragrunt is not installed. Please install it first."
  exit 1
fi

# Check if we're in the right directory
if [[ ! -d "$FOUNDATION_DIR" ]] || [[ ! -d "$RUNTIME_DIR" ]]; then
  error "Terraform directories not found."
  error "Please run this script from the project root directory."
  exit 1
fi

title "Validating Terraform Stacks"

# Set AWS profile
export AWS_PROFILE="$AWS_PROFILE"
info "Using AWS profile: $AWS_PROFILE"

# Check AWS authentication
if ! aws sts get-caller-identity &> /dev/null; then
  error "AWS CLI is not authenticated with profile $AWS_PROFILE."
  error "Please run 'aws configure --profile $AWS_PROFILE' or check your credentials."
  exit 1
fi

# Dynamically fetch AWS account ID and region
info "Fetching AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [[ -z "$AWS_REGION" ]]; then
  error "AWS region is not configured for profile $AWS_PROFILE."
  error "Please run 'aws configure --profile $AWS_PROFILE' and set the region."
  exit 1
fi

info "AWS Account ID: $AWS_ACCOUNT_ID"
info "AWS Region: $AWS_REGION"

# Set common Terraform variables
export TF_VAR_account_id="$AWS_ACCOUNT_ID"
export TF_VAR_region="$AWS_REGION"
export TF_VAR_project="$PROJECT_NAME"
export TF_VAR_email="$EMAIL"

info "Common Terraform variables set:"
info "  account_id: $TF_VAR_account_id"
info "  region: $TF_VAR_region"
info "  project: $TF_VAR_project"
info "  email: $TF_VAR_email"

# Validate Foundation Stack
if [[ "$VALIDATE_FOUNDATION" == "true" ]]; then
  title "Validating Foundation Stack"
  info "Changing to directory: $FOUNDATION_DIR"
  cd "$FOUNDATION_DIR"
  
  # Foundation stack only needs basic variables
  info "Executing: terragrunt validate"
  
  if terragrunt validate; then
    success "✅ Foundation stack validation passed successfully!"
  else
    error "❌ Foundation stack validation failed!"
    exit 1
  fi
  
  # Go back to project root
  cd - > /dev/null
fi

# Validate Runtime Stack
if [[ "$VALIDATE_RUNTIME" == "true" ]]; then
  title "Validating Runtime Stack"
  info "Changing to directory: $RUNTIME_DIR"
  cd "$RUNTIME_DIR"
  
  # Runtime stack needs additional variables
  export TF_VAR_image_tag="$IMAGE_TAG"
  export TF_VAR_certificate_arn=""
  
  info "Runtime-specific variables set:"
  info "  image_tag: $TF_VAR_image_tag"
  info "  certificate_arn: (empty)"
  
  info "Executing: terragrunt validate"
  
  if terragrunt validate; then
    success "✅ Runtime stack validation passed successfully!"
  else
    error "❌ Runtime stack validation failed!"
    exit 1
  fi
  
  # Go back to project root
  cd - > /dev/null
fi

# Final success message
if [[ "$VALIDATE_FOUNDATION" == "true" ]] && [[ "$VALIDATE_RUNTIME" == "true" ]]; then
  success "🎉 All Terraform stacks validated successfully!"
  success "Your infrastructure configuration is valid and ready for deployment."
elif [[ "$VALIDATE_FOUNDATION" == "true" ]]; then
  success "🎉 Foundation stack validated successfully!"
elif [[ "$VALIDATE_RUNTIME" == "true" ]]; then
  success "🎉 Runtime stack validated successfully!"
fi
