# Monthly cost guardrail for the account. Email-only notifications: these are
# free budget notifications, not the paid AWS Budgets Actions feature. The
# automatic shutoff is the cost circuit breaker in the runtime stack
# (terraform/stacks/prod-runtime/circuit_breaker.tf). Thresholds are low to
# match the intended ~$5-10/month envelope for this low-traffic service; the
# forecast notification fires earlier than actual spend when a trend points
# over the ceiling. See docs/COST_CONTROLS.md.
resource "aws_budgets_budget" "monthly_limit" {
  name         = "monthly-${var.project}-budget"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "LinkedAccount"
    values = [data.aws_caller_identity.current.account_id]
  }

  # Actual spend crossed half the monthly ceiling ($5).
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.email]
  }

  # Actual spend crossed 80% of the monthly ceiling ($8).
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.email]
  }

  # Projected to exceed the ceiling by month end; fires before actual does.
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.email]
  }

  tags = {
    Project = var.project
  }
}
