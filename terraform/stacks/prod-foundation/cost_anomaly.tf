# AWS Cost Anomaly Detection (free). Against this account's near-zero baseline,
# any few-dollar spike reads as an anomaly, so this catches abuse or misconfig
# faster and more intelligently than a fixed budget threshold and emails
# var.email. Complements the budget notifications and the runtime circuit
# breaker. Must be created in us-east-1 (Cost Explorer's global endpoint); see
# providers.tf. docs/COST_CONTROLS.md.
resource "aws_ce_anomaly_monitor" "services" {
  provider          = aws.us_east_1
  name              = "${var.project}-service-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "alerts" {
  provider         = aws.us_east_1
  name             = "${var.project}-anomaly-alerts"
  frequency        = "IMMEDIATE"
  monitor_arn_list = [aws_ce_anomaly_monitor.services.arn]

  subscriber {
    type    = "EMAIL"
    address = var.email
  }

  # Alert as soon as a detected anomaly's total cost impact reaches $5.
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = ["5"]
    }
  }
}
