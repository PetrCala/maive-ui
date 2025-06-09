resource "aws_budgets_budget" "monthly_limit" {
  name         = "monthly-${var.project}-budget"
  budget_type  = "COST"
  limit_amount = "100"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "LinkedAccount"
    values = [data.aws_caller_identity.current.account_id]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 10
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.email]
  }

  tags = {
    Project = var.project
  }
}

resource "aws_sns_topic" "budget_alarm" {
  name = "${var.project}-budget-alarm-topic"
}
