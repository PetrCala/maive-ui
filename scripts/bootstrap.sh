#!/usr/bin/env bash
set -euo pipefail

# ---------------- CONFIG ----------------
PROJECT_NAME="maive" # Change this to your project name
REPO_NAME="PetrCala/maive-ui"
TF_DIR="terraform/stacks/prod-foundation"

# Check if aws-cli is installed
if ! command -v aws &>/dev/null; then
  echo "aws-cli is not installed. Please install it and try again."
  exit 1
fi

# Check if the user is authenticated
if ! aws sts get-caller-identity &>/dev/null; then
  echo "AWS CLI is not authenticated. Please configure your credentials and try again."
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
  echo "AWS region is not configured. Please set the region and try again."
  exit 1
fi

read -p "Do you want to deploy the resources in the $REGION region with account ID $ACCOUNT_ID? (yes/no): " CONFIRMATION
if [[ "$CONFIRMATION" != "yes" ]]; then
  echo "Deployment aborted by the user."
  exit 1
fi

echo "Running Terraform in $TF_DIR..."
cd "$TF_DIR"
terraform init -backend-config="key=prod-foundation.tfstate"
terraform apply -var="project=$PROJECT_NAME" -var="region=$REGION" -auto-approve

echo "✅ Bootstrap complete. gha-terraform role created and foundation deployed."
