# AWS Cost Anomaly Detection (free). Against this account's near-zero baseline
# (~$0.24/month), any few-dollar spike reads as an anomaly, so this catches
# abuse or misconfig and emails var.email. Complements the budget notifications
# and the runtime circuit breaker. docs/COST_CONTROLS.md.
#
# Must be created in us-east-1 (Cost Explorer's global endpoint); see
# providers.tf.
#
# The monitor is ADOPTED, not created: AWS enables Cost Anomaly Detection by
# default and allows only ONE dimensional (SERVICE) monitor per account, so
# creating a second one fails with "Limit exceeded on dimensional spend monitor
# creation". This resource was therefore imported from the account's existing
# `Default-Services-Monitor`, and its name is kept as-is to avoid renaming an
# account-level default. On a fresh account, import AWS's default rather than
# letting Terraform create one:
#
#   terragrunt import aws_ce_anomaly_monitor.services <monitor-arn>
#
# Note this means `cloud:destroy` would remove the account's default monitor.
resource "aws_ce_anomaly_monitor" "services" {
  provider          = aws.us_east_1
  name              = "Default-Services-Monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

# A monitor can carry several subscriptions. AWS's own default subscription only
# fires at >= $100 AND >= 40%, which would never catch a problem at this
# project's scale, so this adds a much tighter one alongside it.
#
# DAILY rather than IMMEDIATE: the API rejects IMMEDIATE for anything but an SNS
# topic subscriber ("Immediate frequencies only support SNSTopic subscriptions").
# Anomaly detection runs on billing data that lags ~24h anyway, so a daily digest
# loses nothing; the fast abuse signal is the runtime throttle alarm, not this.
resource "aws_ce_anomaly_subscription" "alerts" {
  provider         = aws.us_east_1
  name             = "${var.project}-anomaly-alerts"
  frequency        = "DAILY"
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
