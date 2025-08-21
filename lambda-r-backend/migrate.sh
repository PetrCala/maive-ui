#!/bin/bash

# Migration script: ECS R Backend -> Lambda
set -e

# Configuration
PROJECT_NAME=${PROJECT_NAME:-"maive"}
AWS_REGION=${AWS_REGION:-"eu-central-1"}
AWS_PROFILE=${AWS_PROFILE:-"kiroku"}

echo "🔄 Starting migration from ECS R Backend to Lambda..."
echo "📋 Project: $PROJECT_NAME"
echo "🌍 Region: $AWS_REGION"
echo "👤 Profile: $AWS_PROFILE"

echo ""
echo "📋 Migration Steps:"
echo "=================="

echo ""
echo "1️⃣  Build and deploy Lambda container image..."
echo "   cd lambda-r-backend"
echo "   chmod +x build.sh"
echo "   ./build.sh"

echo ""
echo "2️⃣  Apply Terraform changes..."
echo "   cd terraform/stacks/prod-foundation"
echo "   terraform plan"
echo "   terraform apply"
echo ""
echo "   cd ../prod-runtime"
echo "   terraform plan"
echo "   terraform apply"

echo ""
echo "3️⃣  Test the new Lambda backend..."
echo "   # Test ping endpoint"
echo "   curl $(aws lambda get-function-url-config --function-name ${PROJECT_NAME}-r-backend --profile $AWS_PROFILE --region $AWS_REGION --query FunctionUrl --output text)/ping"

echo ""
echo "4️⃣  Remove old ECS R backend (optional)..."
echo "   # Comment out R backend resources in ecs.tf"
echo "   # Comment out R backend ALB in alb.tf"
echo "   # Comment out R backend security groups in sg.tf"
echo "   # Apply Terraform changes"

echo ""
echo "⚠️  Important Notes:"
echo "==================="
echo "• The Lambda function URL will be different from your current ALB endpoint"
echo "• Your frontend will automatically use the new Lambda endpoint"
echo "• Lambda has a 10-minute timeout (same as your current setup)"
echo "• Lambda costs: ~$0.20 per million requests + execution time"
echo "• Expected savings: 90%+ reduction in backend costs"

echo ""
echo "🚀 Ready to start? Run the build script first!"
