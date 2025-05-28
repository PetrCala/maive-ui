#!/usr/bin/env bash
set -euo pipefail

# ---------------- CONFIG ----------------
PROJECT_NAME="maive"
TF_DIR="terraform/stacks/prod-foundation"
TF_STATE_BUCKET="${PROJECT_NAME}-tf-state"
TF_STATE_TABLE="${PROJECT_NAME}-tf-locks"

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

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
if [ -z "$AWS_REGION" ]; then
  echo "AWS region is not configured. Please set the region and try again."
  exit 1
fi

read -p "Do you want to deploy the resources in the $AWS_REGION region with account ID $AWS_ACCOUNT_ID? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment aborted by the user."
  exit 1
fi

# === Functions ===

bucket_exists() {
  aws s3api head-bucket --bucket "$TF_STATE_BUCKET" >/dev/null 2>&1
}

ddb_table_exists() {
  aws dynamodb describe-table --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" >/dev/null 2>&1
}

# === Create S3 Bucket ===
#
if bucket_exists; then
  echo "✅ S3 bucket '$TF_STATE_BUCKET' already exists. Skipping creation."
else
  echo "🚀 Creating S3 bucket: $TF_STATE_BUCKET in region $AWS_REGION..."
  aws s3api create-bucket \
    --bucket "$TF_STATE_BUCKET" \
    --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" \
    >/dev/null

  echo "🔐 Enabling default encryption on the bucket..."
  aws s3api put-bucket-encryption \
    --bucket "$TF_STATE_BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }' \
    >/dev/null

  echo "🔒 Blocking all public access on the bucket..."
  aws s3api put-public-access-block \
    --bucket "$TF_STATE_BUCKET" \
    --public-access-block-configuration '{
      "BlockPublicAcls": true,
      "IgnorePublicAcls": true,
      "BlockPublicPolicy": true,
      "RestrictPublicBuckets": true
    }' \
    >/dev/null

  echo "📆 Adding lifecycle rule to expire objects after 30 days..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$TF_STATE_BUCKET" \
    --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "expire-objects-after-30-days",
        "Status": "Enabled",
        "Filter": {
          "Prefix": ""
        },
        "Expiration": {
          "Days": 30
        }
      }
    ]
  }' \
    >/dev/null
fi

# === Create DynamoDB Table ===

if ddb_table_exists; then
  echo "✅ DynamoDB table '$TF_STATE_TABLE' already exists. Skipping creation."
else
  echo "🚀 Creating DynamoDB table for state locking: $TF_STATE_TABLE..."
  aws dynamodb create-table \
    --table-name "$TF_STATE_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION" \
    >/dev/null

  poll_table_existence() {
    local retries=12
    local count=0
    echo "🔍 Checking if DynamoDB table '$TF_STATE_TABLE' exists in region '$AWS_REGION'..."

    while [ $count -lt $retries ]; do
      echo "🔒 Waiting for the table to be created... (Attempt $((count + 1))/$retries)"
      if aws dynamodb describe-table --table-name "$TF_STATE_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
        echo "✅ Table found!"
        return 0
      fi
      sleep 5
      count=$((count + 1))
    done

    echo "❌ Table '$TF_STATE_TABLE' not found after $retries attempts."
    return 1
  }

  if poll_table_existence; then
    echo "🔒 Tagging DynamoDB table for automatic deletion after 30 days..."
    aws dynamodb tag-resource \
      --resource-arn "$(aws dynamodb describe-table --table-name "$TF_STATE_TABLE" --query "Table.TableArn" --output text)" \
      --tags Key=delete-after,Value="$(date -v '+30d' +%Y-%m-%d)" \
      --region "$AWS_REGION" \
      >/dev/null
  else
    echo "❗ Skipping tagging — table does not exist."
    exit 1
fi

# === Run Terraform ===

echo "Running Terraform in $TF_DIR..."
cd "$TF_DIR"
terraform init -backend-config="key=prod-foundation.tfstate"
terraform apply -var="project=$PROJECT_NAME" -var="region=$AWS_REGION" -auto-approve -refresh=true

echo "✅ Bootstrap complete. gha-terraform role created and foundation deployed."
