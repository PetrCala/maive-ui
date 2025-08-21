# Lambda R Backend Configuration
# This replaces the R backend ECS service

# ECR repository for Lambda container
resource "aws_ecr_repository" "lambda_r_backend" {
  name                 = "${var.project}-lambda-r-backend"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = var.project
  }

  force_delete = true
}

# ECR lifecycle policy
resource "aws_ecr_lifecycle_policy" "lambda_r_backend_cleanup" {
  repository = aws_ecr_repository.lambda_r_backend.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = { type = "expire" }
      }
    ]
  })
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_r_backend" {
  name = "${var.project}-lambda-r-backend-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_r_backend_basic" {
  role       = aws_iam_role.lambda_r_backend.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function
resource "aws_lambda_function" "r_backend" {
  function_name = "${var.project}-r-backend"
  role          = aws_iam_role.lambda_r_backend.arn
  handler       = "index.handler"
  runtime       = "provided.al2"
  timeout       = 600  # 10 minutes
  memory_size   = 1024 # 1GB (same as current ECS task)

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.lambda_r_backend.repository_url}:latest"

  environment {
    variables = {
      R_HOME = "/usr/lib64/R"
    }
  }

  tags = {
    Project = var.project
  }
}

# Lambda function URL for direct HTTP access
resource "aws_lambda_function_url" "r_backend" {
  function_name      = aws_lambda_function.r_backend.function_name
  authorization_type = "NONE" # Public access as requested

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# CloudWatch log group for Lambda
resource "aws_cloudwatch_log_group" "lambda_r_backend" {
  name              = "/aws/lambda/${aws_lambda_function.r_backend.function_name}"
  retention_in_days = 7

  tags = {
    Project = var.project
  }
}

# Lambda monitoring and alarms
resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_errors" {
  alarm_name          = "${var.project}-lambda-r-backend-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Lambda R backend has errors"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_duration" {
  alarm_name          = "${var.project}-lambda-r-backend-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "300000" # 5 minutes in milliseconds
  alarm_description   = "Lambda R backend execution time is high"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

# Lambda dashboard
resource "aws_cloudwatch_dashboard" "lambda_r_backend" {
  dashboard_name = "${var.project}-lambda-r-backend-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.r_backend.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.region
          title  = "Lambda R Backend Metrics"
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          query  = "SOURCE '${aws_cloudwatch_log_group.lambda_r_backend.name}'\n| fields @timestamp, @message\n| filter @message like /ERROR|WARN|CRITICAL/\n| sort @timestamp desc\n| limit 100"
          region = var.region
          title  = "Lambda R Backend Error Logs"
        }
      }
    ]
  })
}
