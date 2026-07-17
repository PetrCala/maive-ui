# Async runs queue. The orchestrator consumes this; failures are NOT retried
# (maxReceiveCount = 1). Model/analysis failures are recorded as terminal
# states by the orchestrator, and only infra failures (a thrown handler) reach
# the DLQ. MCMC is nondeterministic, so auto-retry is intentionally disabled.

resource "aws_sqs_queue" "runs_dlq" {
  name                      = "${var.project}-runs-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = { Project = var.project }
}

resource "aws_sqs_queue" "runs" {
  name                       = "${var.project}-runs"
  visibility_timeout_seconds = 660   # > R Lambda timeout (600s) + overhead
  message_retention_seconds  = 86400 # 1 day
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.runs_dlq.arn
    maxReceiveCount     = 1
  })
  tags = { Project = var.project }
}

# Alarm when anything lands in the DLQ (orchestrator/infra failure).
resource "aws_cloudwatch_metric_alarm" "runs_dlq_not_empty" {
  alarm_name          = "${var.project}-runs-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "Async runs DLQ has messages (orchestrator/infra failure)"
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    QueueName = aws_sqs_queue.runs_dlq.name
  }
}
