# CloudWatch Alarms for monitoring and cost optimization

# High CPU Usage Alarm
resource "aws_cloudwatch_metric_alarm" "ui_high_cpu" {
  alarm_name          = "${var.project}-ui-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors UI ECS CPU utilization"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.ui.name
  }
}

# High Memory Usage Alarm
resource "aws_cloudwatch_metric_alarm" "ui_high_memory" {
  alarm_name          = "${var.project}-ui-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors UI ECS memory utilization"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.ui.name
  }
}

# ALB 5XX Error Alarm
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.project}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ALB 5XX errors"
  alarm_actions       = []

  dimensions = {
    LoadBalancer = aws_lb.ui.arn_suffix
    TargetGroup  = aws_lb_target_group.ui.arn_suffix
  }
}

# Cost Optimization Alarm - High Request Count
resource "aws_cloudwatch_metric_alarm" "high_request_count" {
  alarm_name          = "${var.project}-high-request-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1000"
  alarm_description   = "This metric monitors high request count for cost awareness"
  alarm_actions       = []

  dimensions = {
    LoadBalancer = aws_lb.ui.arn_suffix
    TargetGroup  = aws_lb_target_group.ui.arn_suffix
  }
}
