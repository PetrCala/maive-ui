# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
}

# UI High CPU Usage Alarm
resource "aws_cloudwatch_metric_alarm" "ui_high_cpu" {
  alarm_name          = "${var.project}-ui-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "This metric monitors UI ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.ui.name
  }
}

# High Memory Usage Alarm
resource "aws_cloudwatch_metric_alarm" "ui_high_memory" {
  alarm_name          = "${var.project}-ui-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "This metric monitors UI ECS memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.ui.name
  }
}

# ALB 5xx Errors Alarm (conditional based on use_secure_setup)
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count               = var.use_secure_setup ? 1 : 0
  alarm_name          = "${var.project}-ui-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5xx errors are too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.ui[0].arn_suffix
    TargetGroup  = aws_lb_target_group.ui[0].arn_suffix
  }
}

# ALB Target Response Time Alarm (conditional based on use_secure_setup)
resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  count               = var.use_secure_setup ? 1 : 0
  alarm_name          = "${var.project}-ui-alb-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 2.0
  alarm_description   = "ALB target response time is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.ui[0].arn_suffix
    TargetGroup  = aws_lb_target_group.ui[0].arn_suffix
  }
}

# High Request Count Alarm (conditional based on use_secure_setup)
resource "aws_cloudwatch_metric_alarm" "high_request_count" {
  count               = var.use_secure_setup ? 1 : 0
  alarm_name          = "${var.project}-ui-high-request-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000
  alarm_description   = "Request count is unusually high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.ui[0].arn_suffix
    TargetGroup  = aws_lb_target_group.ui[0].arn_suffix
  }
}
