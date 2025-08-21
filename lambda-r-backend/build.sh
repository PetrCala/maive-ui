#!/bin/bash

# Build and deploy Lambda R Backend
set -e

# Configuration
PROJECT_NAME=${PROJECT_NAME:-"maive"}
AWS_REGION=${AWS_REGION:-"eu-central-1"}
AWS_PROFILE=${AWS_PROFILE:-"kiroku"}

echo "🚀 Building Lambda R Backend for project: $PROJECT_NAME"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-lambda-r-backend"

echo "📦 ECR Repository: $ECR_REPO"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t lambda-r-backend .

# Tag the image
echo "🏷️  Tagging image..."
docker tag lambda-r-backend:latest $ECR_REPO:latest

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --profile $AWS_PROFILE --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Push the image
echo "⬆️  Pushing image to ECR..."
docker push $ECR_REPO:latest

echo "✅ Lambda R Backend image built and pushed successfully!"
echo "📋 Next steps:"
echo "   1. Update the Lambda function in Terraform to use the container image"
echo "   2. Apply the Terraform changes"
echo "   3. Test the new Lambda backend"
