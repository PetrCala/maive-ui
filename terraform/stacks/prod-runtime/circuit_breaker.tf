# Cost circuit breaker (docs/COST_CONTROLS.md).
#
# The reserved-concurrency cap on the R backend bounds the *rate* of spend but
# not the monthly total: 10 concurrent 3.5 GB executions pinned around the clock
# is still ~$1,490/month. This is the free automatic backstop that enforces a
# ceiling. When the backend throttles continuously for
# var.cost_circuit_breaker_throttle_periods 5-minute periods (demand exceeding
# the cap for ~30 minutes straight, a strong abuse signal with near-zero
# false-positive rate for a low-traffic site), a CloudWatch alarm publishes to
# SNS, which invokes a Lambda that sets the backend's reserved concurrency to 0.
# All further compute then throttles (429) until an operator restores the cap.
#
# This is the free equivalent of AWS Budgets Actions (which is a paid feature):
# CloudWatch alarm -> SNS -> Lambda, entirely within AWS free tiers.

locals {
  circuit_breaker_count = var.cost_circuit_breaker_enabled ? 1 : 0
}

# Topic the saturation alarm publishes to. Always created so the alarm has a
# valid target and an operator is emailed when the breaker condition is met;
# the auto-shutoff Lambda subscribes only when the breaker is enabled.
resource "aws_sns_topic" "cost_circuit_breaker" {
  name = "${var.project}-cost-circuit-breaker"
  tags = { Project = var.project }
}

resource "aws_sns_topic_subscription" "cost_circuit_breaker_email" {
  topic_arn = aws_sns_topic.cost_circuit_breaker.arn
  protocol  = "email"
  endpoint  = var.email
}

# Sustained throttling of the R backend. Distinct from the single-period
# throttle alarm in lambda.tf (a fast FYI): this one requires continuous
# throttling across the full window before it acts, so it is the deliberate
# auto-shutoff trigger rather than a notification.
resource "aws_cloudwatch_metric_alarm" "lambda_r_backend_saturation" {
  alarm_name          = "${local.lambda_r_backend_function_name}-saturation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.cost_circuit_breaker_throttle_periods
  datapoints_to_alarm = var.cost_circuit_breaker_throttle_periods
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  treat_missing_data  = "notBreaching"
  alarm_description   = "R backend throttling continuously; cost circuit breaker trips."
  alarm_actions       = [aws_sns_topic.cost_circuit_breaker.arn]
  # No ok_actions: after a trip the backend sits at 0 concurrency, so a quiet
  # spell returns the alarm to OK while the service is still deliberately off.
  # Recovery is an explicit operator action, not an automated "recovered" email.

  dimensions = {
    FunctionName = aws_lambda_function.r_backend.function_name
  }
}

# --- Auto-shutoff Lambda (only when the breaker is enabled) ------------------

data "archive_file" "kill_switch" {
  count       = local.circuit_breaker_count
  type        = "zip"
  source_dir  = "${path.module}/../../../apps/kill-switch"
  output_path = "${path.module}/kill_switch.zip"
}

resource "aws_iam_role" "kill_switch" {
  count = local.circuit_breaker_count
  name  = "${var.project}-cost-circuit-breaker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "kill_switch_basic" {
  count      = local.circuit_breaker_count
  role       = aws_iam_role.kill_switch[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The kill switch only needs to throttle the R backend to 0. Scoped to that one
# function ARN.
resource "aws_iam_policy" "kill_switch" {
  count       = local.circuit_breaker_count
  name        = "${var.project}-cost-circuit-breaker-policy"
  description = "Allow the cost circuit breaker to set reserved concurrency on the R backend"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:PutFunctionConcurrency"]
        Resource = aws_lambda_function.r_backend.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "kill_switch" {
  count      = local.circuit_breaker_count
  role       = aws_iam_role.kill_switch[0].name
  policy_arn = aws_iam_policy.kill_switch[0].arn
}

resource "aws_cloudwatch_log_group" "kill_switch" {
  count             = local.circuit_breaker_count
  name              = "/aws/lambda/${var.project}-cost-circuit-breaker"
  retention_in_days = var.ui_lambda_log_retention_days
  tags              = { Project = var.project }
}

resource "aws_lambda_function" "kill_switch" {
  count            = local.circuit_breaker_count
  function_name    = "${var.project}-cost-circuit-breaker"
  role             = aws_iam_role.kill_switch[0].arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 128
  filename         = data.archive_file.kill_switch[0].output_path
  source_code_hash = data.archive_file.kill_switch[0].output_base64sha256

  environment {
    variables = {
      PROTECTED_FUNCTIONS = aws_lambda_function.r_backend.function_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.kill_switch]
  tags       = { Project = var.project }
}

resource "aws_sns_topic_subscription" "cost_circuit_breaker_lambda" {
  count     = local.circuit_breaker_count
  topic_arn = aws_sns_topic.cost_circuit_breaker.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.kill_switch[0].arn
}

resource "aws_lambda_permission" "cost_circuit_breaker_sns" {
  count         = local.circuit_breaker_count
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kill_switch[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.cost_circuit_breaker.arn
}

# Daily compute budget alarm (#533). The $10 monthly budget never fired during
# the Aug 15 incident because free-tier compute overage is a usage limit, not
# dollars: ~139k GB-s burned in a day and the first signal was an AWS email a
# day later. This alarm watches the actual usage metric: total GB-seconds per
# day across the Lambdas, computed with metric math as Sum(Duration) x memory
# for each function. It publishes to the circuit-breaker topic, so crossing the
# budget emails the operator and, when the breaker is enabled, also trips the
# auto-shutoff above. With a one-day period CloudWatch evaluates the partial
# day's sum as it accumulates, so the alarm fires mid-spike rather than at
# midnight. Three metrics plus free math expressions, within the 10 always-free
# alarm metrics.
resource "aws_cloudwatch_metric_alarm" "lambda_daily_gb_seconds" {
  alarm_name          = "${var.project}-lambda-daily-gb-seconds"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = var.lambda_daily_gb_seconds_budget
  treat_missing_data  = "notBreaching"
  alarm_description   = "Daily Lambda compute exceeded the GB-seconds budget; cost circuit breaker trips."
  alarm_actions       = [aws_sns_topic.cost_circuit_breaker.arn]
  # No ok_actions, for the same reason as the saturation alarm above.

  metric_query {
    id          = "gbs"
    expression  = "(r * ${aws_lambda_function.r_backend.memory_size} + ui * ${aws_lambda_function.ui.memory_size} + orch * ${aws_lambda_function.orchestrator.memory_size}) / 1024 / 1000"
    label       = "Lambda GB-seconds per day"
    return_data = true
  }

  metric_query {
    id = "r"
    metric {
      metric_name = "Duration"
      namespace   = "AWS/Lambda"
      period      = 86400
      stat        = "Sum"
      dimensions = {
        FunctionName = aws_lambda_function.r_backend.function_name
      }
    }
  }

  metric_query {
    id = "ui"
    metric {
      metric_name = "Duration"
      namespace   = "AWS/Lambda"
      period      = 86400
      stat        = "Sum"
      dimensions = {
        FunctionName = aws_lambda_function.ui.function_name
      }
    }
  }

  metric_query {
    id = "orch"
    metric {
      metric_name = "Duration"
      namespace   = "AWS/Lambda"
      period      = 86400
      stat        = "Sum"
      dimensions = {
        FunctionName = aws_lambda_function.orchestrator.function_name
      }
    }
  }
}
