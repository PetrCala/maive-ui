# Lambda R Backend Configuration

data "aws_iam_role" "ui_task" {
  name = "${var.project}-ui-task"
}

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
  function_name = local.lambda_r_backend_function_name
  role          = aws_iam_role.lambda_r_backend.arn
  timeout       = var.lambda_r_backend_timeout
  memory_size   = var.lambda_r_backend_memory_size

  package_type = "Image"
  image_uri    = "${data.aws_ecr_repository.lambda_r_backend.repository_url}:${var.image_tag}"

  environment {
    variables = {
      R_HOME = "/usr/local/lib/R"
    }
  }

  tags = {
    Project = var.project
  }
}

resource "aws_lambda_provisioned_concurrency_config" "r_backend" {
  count                             = var.lambda_r_backend_reserved_concurrency > 0 ? 1 : 0
  function_name                     = aws_lambda_function.r_backend.function_name
  provisioned_concurrent_executions = var.lambda_r_backend_reserved_concurrency
  qualifier                         = "$LATEST"
}

# Lambda function URL for direct HTTP access
resource "aws_lambda_function_url" "r_backend" {
  function_name      = aws_lambda_function.r_backend.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# Allow UI ECS task to invoke the Lambda function
resource "aws_lambda_permission" "ui_task_invoke" {
  statement_id  = "AllowUITaskInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.r_backend.function_name
  principal     = "ecs-tasks.amazonaws.com"
  source_arn    = aws_ecs_task_definition.ui.task_role_arn
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
  alarm_actions       = []

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
  alarm_actions       = []

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
