# Lambda R Backend Configuration

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_r_backend" {
  name = "${local.lambda_r_backend_function_name}-role"

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
  function_name                  = local.lambda_r_backend_function_name
  role                           = aws_iam_role.lambda_r_backend.arn
  timeout                        = var.lambda_r_backend_timeout
  memory_size                    = var.lambda_r_backend_memory_size
  reserved_concurrent_executions = var.lambda_r_backend_reserved_concurrency

  package_type = "Image"
  image_uri    = "${data.aws_ecr_repository.lambda_r_backend.repository_url}:${var.image_tag}"

  # To set environment variables, use the following:
  # environment {
  #   variables = {}
  # }

  tags = {
    Project = var.project
  }
}

# Lambda function URL for direct HTTP access
resource "aws_lambda_function_url" "r_backend" {
  function_name      = aws_lambda_function.r_backend.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

resource "aws_lambda_permission" "public_invoke" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.r_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Lambda monitoring and alarms
resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_errors" {
  alarm_name          = "${local.lambda_r_backend_function_name}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Lambda R backend has errors"
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

# Throttle alarm: with reserved concurrency now capping the R backend
# (docs/PUBLIC_API_DESIGN.md D2), throttles are the signal that the cap is being
# hit, whether from an abusive caller or organic growth that warrants raising it.
resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_throttles" {
  alarm_name          = "${local.lambda_r_backend_function_name}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Lambda R backend is being throttled (reserved concurrency cap reached)"
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_duration" {
  alarm_name          = "${local.lambda_r_backend_function_name}-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_r_backend_timeout * 1000 # Convert seconds to milliseconds
  alarm_description   = "Lambda R backend execution time is high"
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

# Lambda dashboard
resource "aws_cloudwatch_dashboard" "lambda_r_backend" {
  dashboard_name = "${local.lambda_r_backend_function_name}-dashboard"

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
            [".", "Duration", ".", "."],
            [".", "Throttles", ".", "."]
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
          query  = "SOURCE '${data.aws_cloudwatch_log_group.lambda_r_backend_logs.name}'\n| fields @timestamp, @message\n| filter @message like /ERROR|WARN|CRITICAL/\n| sort @timestamp desc\n| limit 100"
          region = var.region
          title  = "Lambda R Backend Error Logs"
        }
      }
    ]
  })
}

data "aws_ecr_repository" "lambda_r_backend" {
  name = "${var.project}-${var.lambda_r_backend_function_base_name}"
}
