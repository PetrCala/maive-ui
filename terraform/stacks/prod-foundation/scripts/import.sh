#!/bin/bash

# This is a temporary script to import the resources into the Terraform state.

PROJECT_NAME="maive"

# ECR Repositories
terraform import 'aws_ecr_repository.repos["react-ui"]' $PROJECT_NAME-react-ui
terraform import 'aws_ecr_repository.repos["lambda-r-backend"]' $PROJECT_NAME-lambda-r-backend

# IAM Role
terraform import aws_iam_role.gha_terraform gha-terraform

# CloudWatch Log Groups
terraform import 'aws_cloudwatch_log_group.service["react-ui"]' /ecs/$PROJECT_NAME/react-ui
terraform import 'aws_cloudwatch_log_group.service["lambda-r-backend"]' /aws/lambda/$PROJECT_NAME-r-backend

# S3 Bucket
terraform import aws_s3_bucket.data $PROJECT_NAME-user-data

aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)].Arn' --output text