#!/bin/bash
set -euo pipefail

# Configuration
PROJECT_NAME="maive"
TF_STATE_BUCKET="${PROJECT_NAME}-tf-state"
TF_STATE_TABLE="${PROJECT_NAME}-tf-locks"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

  terraform init -backend-config="key=prod-${stack}.tfstate"
  terraform destroy -auto-approve

  cd - >/dev/null
  echo -e "${GREEN}${stack} infrastructure destroyed successfully${NC}"
}

# Function to destroy bootstrap resources
destroy_bootstrap() {
  echo -e "${YELLOW}Destroying bootstrap resources...${NC}"

  # Check if the S3 bucket exists
  if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" >/dev/null 2>&1; then
    echo "Emptying S3 bucket: $TF_STATE_BUCKET"
    aws s3 rm "s3://$TF_STATE_BUCKET" --recursive >/dev/null 2>&1

    echo "Deleting S3 bucket: $TF_STATE_BUCKET"
    aws s3api delete-bucket --bucket "$TF_STATE_BUCKET" --region "$AWS_REGION" >/dev/null 2>&1
  else
    echo "S3 bucket $TF_STATE_BUCKET does not exist"
  fi

  # Check if the DynamoDB table exists
  if aws dynamodb describe-table --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" &>/dev/null; then
    echo "Deleting DynamoDB table: $TF_STATE_TABLE"
    aws dynamodb delete-table --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" >/dev/null 2>&1
  else
    echo "DynamoDB table $TF_STATE_TABLE does not exist"
  fi

  echo -e "${GREEN}Bootstrap resources destroyed successfully${NC}"
}

# Main execution
echo -e "${YELLOW}Starting infrastructure destruction...${NC}"

# Check prerequisites
check_aws_credentials
check_env_vars

# Confirm with user
read -p "This will destroy ALL infrastructure. Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Operation cancelled${NC}"
  exit 1
fi

# Execute destruction
# destroy_infrastructure_stack "runtime"
destroy_infrastructure_stack "foundation"
destroy_bootstrap

echo -e "${GREEN}All infrastructure has been destroyed successfully${NC}"
