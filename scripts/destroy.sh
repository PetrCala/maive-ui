#!/bin/bash
set -euo pipefail

# ---------------- INPUTS ----------------
PROJECT_NAME="maive"
EMAIL="cala.p@seznam.cz"

TF_STATE_BUCKET="${PROJECT_NAME}-tf-state"
TF_STATE_TABLE="${PROJECT_NAME}-tf-locks"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# Function to check if AWS credentials are configured
check_aws_credentials() {
  if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
  fi
}

# Function to check if required environment variables are set
check_env_vars() {
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: AWS_ACCOUNT_ID environment variable is not set${NC}"
    exit 1
  fi
}

destroy_infrastructure_stack() {
  local stack=$1
  echo -e "${YELLOW}Destroying ${stack} infrastructure...${NC}"
  cd "terraform/stacks/prod-${stack}"

  terragrunt init
  terragrunt destroy -auto-approve

  cd - >/dev/null
  echo -e "${GREEN}${stack} infrastructure destroyed successfully${NC}"
}

# Function to clear bootstrap resources
clear_bootstrap_resources() {
  echo -e "${YELLOW}Clearing bootstrap resources...${NC}"

  # Check if the S3 bucket exists
  if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" >/dev/null 2>&1; then
    echo "Emptying S3 bucket: $TF_STATE_BUCKET"
    aws s3 rm "s3://$TF_STATE_BUCKET" --recursive >/dev/null 2>&1
    echo "✅ S3 bucket contents cleared (bucket preserved)"
  else
    echo "S3 bucket $TF_STATE_BUCKET does not exist"
  fi

  # Check if the DynamoDB table exists
  if aws dynamodb describe-table --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" &>/dev/null; then
    echo "Clearing DynamoDB table: $TF_STATE_TABLE"
    
    # Get all items in the table
    local items
    items=$(aws dynamodb scan --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" --query 'Items[].LockID.S' --output text 2>/dev/null || echo "")
    
    if [[ -n "$items" ]]; then
      echo "  Removing existing lock items..."
      for item in $items; do
        if [[ "$item" != "None" && -n "$item" ]]; then
          aws dynamodb delete-item \
            --table-name "$TF_STATE_TABLE" \
            --key "{\"LockID\":{\"S\":\"$item\"}}" \
            --region "$AWS_REGION" >/dev/null 2>&1 || echo "    Warning: Could not remove item $item"
        fi
      done
    fi
    
    echo "✅ DynamoDB table contents cleared (table preserved)"
  else
    echo "DynamoDB table $TF_STATE_TABLE does not exist"
  fi

  echo -e "${GREEN}Bootstrap resources cleared successfully${NC}"
}

# Parse command line arguments
RUN_VPC_CLEANUP=false
DESTROY_FOUNDATION=true
DESTROY_RUNTIME=true
CLEAR_BOOTSTRAP=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --vpc-cleanup)
      RUN_VPC_CLEANUP=true
      shift
      ;;
    --foundation-only)
      DESTROY_FOUNDATION=true
      DESTROY_RUNTIME=false
      CLEAR_BOOTSTRAP=false
      shift
      ;;
    --runtime-only)
      DESTROY_FOUNDATION=false
      DESTROY_RUNTIME=true
      CLEAR_BOOTSTRAP=false
      shift
      ;;
    --keep-bootstrap)
      CLEAR_BOOTSTRAP=false
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --foundation-only    Destroy only foundation stack (VPC, ECR, IAM)"
      echo "  --runtime-only       Destroy only runtime stack (ECS, ALB, WAF)"
      echo "  --vpc-cleanup        Run comprehensive VPC cleanup after Terraform destroy"
      echo "  --keep-bootstrap     Keep S3 bucket and DynamoDB table (don't clear contents)"
      echo "  --help, -h           Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                           # Destroy everything (default)"
      echo "  $0 --foundation-only         # Destroy only foundation stack"
      echo "  $0 --runtime-only            # Destroy only runtime stack"
      echo "  $0 --vpc-cleanup            # Destroy everything with VPC cleanup"
      echo "  $0 --foundation-only --keep-bootstrap  # Destroy foundation, keep backend"
      echo ""
      echo "Note: --foundation-only and --runtime-only are mutually exclusive"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate mutually exclusive options
if [[ "$DESTROY_FOUNDATION" == "true" && "$DESTROY_RUNTIME" == "false" ]] && [[ "$DESTROY_FOUNDATION" == "false" && "$DESTROY_RUNTIME" == "true" ]]; then
  # This is fine - one of the "only" flags was used
  :
elif [[ "$DESTROY_FOUNDATION" == "false" && "$DESTROY_RUNTIME" == "false" ]]; then
  echo -e "${RED}Error: Cannot destroy nothing. Use --help for valid options.${NC}"
  exit 1
fi

# Main execution
if [[ "$DESTROY_FOUNDATION" == "true" && "$DESTROY_RUNTIME" == "true" ]]; then
  echo -e "${YELLOW}Starting complete infrastructure destruction...${NC}"
  DESTRUCTION_SCOPE="ALL infrastructure"
elif [[ "$DESTROY_FOUNDATION" == "true" ]]; then
  echo -e "${YELLOW}Starting foundation-only infrastructure destruction...${NC}"
  DESTRUCTION_SCOPE="foundation stack only"
else
  echo -e "${YELLOW}Starting runtime-only infrastructure destruction...${NC}"
  DESTRUCTION_SCOPE="runtime stack only"
fi

# Check prerequisites
check_aws_credentials
check_env_vars

# Confirm with user
read -p "This will destroy ${DESTRUCTION_SCOPE}. Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Operation cancelled${NC}"
  exit 1
fi

# === Prepare env variables ===
export TF_VAR_project="$PROJECT_NAME"
export TF_VAR_region="$AWS_REGION"
export TF_VAR_account_id="$AWS_ACCOUNT_ID"
export TF_VAR_email="$EMAIL"
export TF_VAR_image_tag="$(git rev-parse --short HEAD)"

# Execute destruction based on flags
if [[ "$DESTROY_RUNTIME" == "true" ]]; then
  echo -e "${YELLOW}Destroying runtime stack...${NC}"
  destroy_infrastructure_stack "runtime" || echo -e "${YELLOW}Runtime stack destruction had issues, continuing...${NC}"
else
  echo -e "${BLUE}Skipping runtime stack destruction${NC}"
fi

if [[ "$DESTROY_FOUNDATION" == "true" ]]; then
  echo -e "${YELLOW}Destroying foundation stack...${NC}"
  destroy_infrastructure_stack "foundation" || echo -e "${YELLOW}Foundation stack destruction had issues, continuing...${NC}"
else
  echo -e "${BLUE}Skipping foundation stack destruction${NC}"
fi

# Conditionally run comprehensive VPC cleanup
if [[ "$RUN_VPC_CLEANUP" == "true" ]]; then
  echo -e "${YELLOW}Running comprehensive VPC cleanup to ensure all resources are removed...${NC}"
  ./scripts/cleanup-vpc.sh
else
  echo -e "${BLUE}Skipping VPC cleanup (use --vpc-cleanup flag to enable)${NC}"
fi

# Conditionally clear bootstrap resources
if [[ "$CLEAR_BOOTSTRAP" == "true" ]]; then
  clear_bootstrap_resources
else
  echo -e "${BLUE}Keeping bootstrap resources (S3 bucket and DynamoDB table)${NC}"
fi

# Final success message
if [[ "$DESTROY_FOUNDATION" == "true" && "$DESTROY_RUNTIME" == "true" ]]; then
  echo -e "${GREEN}All infrastructure has been destroyed and backend resources cleared successfully${NC}"
elif [[ "$DESTROY_FOUNDATION" == "true" ]]; then
  echo -e "${GREEN}Foundation infrastructure has been destroyed successfully${NC}"
else
  echo -e "${GREEN}Runtime infrastructure has been destroyed successfully${NC}"
fi
