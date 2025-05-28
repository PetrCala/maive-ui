#!/usr/bin/env bash
set -euo pipefail

# ---------------- CONFIG ----------------
PROJECT_NAME="maive" # Change this to your project name
REPO_NAME="PetrCala/maive-ui"
TF_DIR="terraform/stacks/prod-foundation"
BUCKET_NAME="maive-tf-state"
DDB_TABLE_NAME="maive-tf-locks"

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

read -p "Do you want to deploy the resources in the $REGION region with account ID $ACCOUNT_ID? (y/n): " CONFIRMATION
if [[ "$CONFIRMATION" != "y" && "$CONFIRMATION" != "yes" ]]; then
  echo "Deployment aborted by the user."
  exit 1
fi

# === Functions ===

bucket_exists() {
  aws s3api head-bucket --bucket "$BUCKET_NAME" >/dev/null 2>&1
}

ddb_table_exists() {
  aws dynamodb describe-table --table-name "$DDB_TABLE_NAME" --region "$REGION" >/dev/null 2>&1
}

# === Create S3 Bucket ===
#
if bucket_exists; then
  echo "✅ S3 bucket '$BUCKET_NAME' already exists. Skipping creation."
else
  echo "🚀 Creating S3 bucket: $BUCKET_NAME in region $REGION..."
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" \
    >/dev/null

  echo "🔐 Enabling default encryption on the bucket..."
  aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
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
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration '{
      "BlockPublicAcls": true,
      "IgnorePublicAcls": true,
      "BlockPublicPolicy": true,
      "RestrictPublicBuckets": true
    }' \
    >/dev/null

  echo "📆 Adding lifecycle rule to expire objects after 30 days..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
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
  echo "✅ DynamoDB table '$DDB_TABLE_NAME' already exists. Skipping creation."
else
  echo "🚀 Creating DynamoDB table for state locking: $DDB_TABLE_NAME..."
  aws dynamodb create-table \
    --table-name "$DDB_TABLE_NAME" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    >/dev/null

  echo "🔒 Tagging DynamoDB table for automatic deletion after 30 days..."
  aws dynamodb tag-resource \
    --resource-arn "$(aws dynamodb describe-table --table-name "$DDB_TABLE_NAME" --query "Table.TableArn" --output text)" \
    --tags Key=delete-after,Value="$(date -v '+30d' +%Y-%m-%d)" \
    --region "$REGION" \
    >/dev/null
fi
# === Run Terraform ===

echo "Running Terraform in $TF_DIR..."
cd "$TF_DIR"
terraform init -backend-config="key=prod-foundation.tfstate"
terraform apply -var="project=$PROJECT_NAME" -var="region=$REGION" -auto-approve -refresh=true

echo "✅ Bootstrap complete. gha-terraform role created and foundation deployed."
