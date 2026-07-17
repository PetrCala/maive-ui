# Operational alarm notifications.
#
# A single SNS topic that the operational CloudWatch alarms (errors, throttles,
# duration, DLQ) publish to, delivered by email so an operator actually learns
# when something fires. Previously every alarm had empty `alarm_actions` and
# notified no one. This is notification only; the automatic cost shutoff lives
# in circuit_breaker.tf and uses a separate topic.
#
# The email subscription must be confirmed once (AWS sends a confirmation link
# to var.email on first apply).

resource "aws_sns_topic" "alarm_notifications" {
  name = "${var.project}-alarm-notifications"
  tags = { Project = var.project }
}

resource "aws_sns_topic_subscription" "alarm_notifications_email" {
  topic_arn = aws_sns_topic.alarm_notifications.arn
  protocol  = "email"
  endpoint  = var.email
}
