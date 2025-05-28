#!/bin/bash

# This is a temporary script to import the resources into the Terraform state.

PROJECT_NAME="maive"

# ECR Repositories
terraform import 'aws_ecr_repository.repos["react-ui"]' $PROJECT_NAME-react-ui
terraform import 'aws_ecr_repository.repos["flask-api"]' $PROJECT_NAME-flask-api
terraform import 'aws_ecr_repository.repos["r-plumber"]' $PROJECT_NAME-r-plumber

# IAM Role
terraform import aws_iam_role.gha_terraform gha-terraform

# CloudWatch Log Groups
terraform import 'aws_cloudwatch_log_group.service["react-ui"]' /ecs/$PROJECT_NAME/react-ui
terraform import 'aws_cloudwatch_log_group.service["flask-api"]' /ecs/$PROJECT_NAME/flask-api
terraform import 'aws_cloudwatch_log_group.service["r-plumber"]' /ecs/$PROJECT_NAME/r-plumber

# S3 Bucket
terraform import aws_s3_bucket.data $PROJECT_NAME-user-data
