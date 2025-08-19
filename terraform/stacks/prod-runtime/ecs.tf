# Execution role shared by all tasks
data "aws_iam_policy" "ecs_task_execution" {
  arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_tasks" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_exec" {
  name               = "${var.project}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks.json
}
resource "aws_iam_role_policy_attachment" "task_exec" {
  role       = aws_iam_role.task_exec.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

# ---------------- React UI ----------------
resource "aws_ecs_task_definition" "ui" {
  family                   = "${var.project}-ui"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ui_task_cpu
  memory                   = var.ui_task_mem
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task_exec.arn

  container_definitions = jsonencode([{
    name         = "ui"
    image        = "${local.ecr_urls["react-ui"]}:${var.image_tag}"
    portMappings = [{ containerPort = local.ui_port, protocol = "tcp" }]
    environment = [
      { name = "NEXT_PUBLIC_R_API_URL", value = "http://${aws_lb.r.dns_name}" }, # Using DNS name
    ]
    logConfiguration = {
      logDriver = "awslogs",
      options   = { awslogs-group = local.ui_log_group_name, awslogs-region = var.region, awslogs-stream-prefix = "ecs" }
    }
  }])
}

resource "aws_ecs_service" "ui" {
  name            = "${var.project}-ui"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.ui.arn
  desired_count   = var.ui_desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [module.sg_ui_tasks.security_group_id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.ui.arn
    container_name   = "ui"
    container_port   = local.ui_port
  }
  enable_execute_command = true
}

# Auto Scaling for UI tasks
resource "aws_appautoscaling_target" "ui_target" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.ui.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ui_cpu_policy" {
  name               = "${var.project}-ui-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ui_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ui_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ui_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# ---------------- R plumber ----------------
resource "aws_ecs_task_definition" "r" {
  family                   = "${var.project}-r-plumber"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.r_task_cpu
  memory                   = var.r_task_mem
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task_exec.arn

  container_definitions = jsonencode([{
    name         = "r"
    image        = "${local.ecr_urls["r-plumber"]}:${var.image_tag}"
    portMappings = [{ containerPort = local.r_port, protocol = "tcp" }]
    environment = [
      { name = "R_HOST", value = "0.0.0.0" },
      { name = "R_PORT", value = tostring(local.r_port) }
    ]
    logConfiguration = {
      logDriver = "awslogs",
      options   = { awslogs-group = local.r_log_group_name, awslogs-region = var.region, awslogs-stream-prefix = "ecs" }
    }
  }])
}

resource "aws_ecs_service" "r" {
  name            = "${var.project}-r-plumber"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.r.arn
  desired_count   = var.r_desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [module.sg_r_tasks.security_group_id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.r.arn
    container_name   = "r"
    container_port   = local.r_port
  }
  enable_execute_command = true
}

# R Service Monitoring and Alarms
resource "aws_cloudwatch_metric_alarm" "r_cpu_high" {
  alarm_name          = "${var.project}-r-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "R service CPU usage is consistently high (>80% for 10 minutes)"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

resource "aws_cloudwatch_metric_alarm" "r_cpu_critical" {
  alarm_name          = "${var.project}-r-cpu-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "95"
  alarm_description   = "R service CPU usage is critically high (>95% for 5 minutes)"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

resource "aws_cloudwatch_metric_alarm" "r_memory_high" {
  alarm_name          = "${var.project}-r-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "R service memory usage is high (>85% for 10 minutes)"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

resource "aws_cloudwatch_metric_alarm" "r_memory_critical" {
  alarm_name          = "${var.project}-r-memory-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "95"
  alarm_description   = "R service memory usage is critically high (>95% for 5 minutes)"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

resource "aws_cloudwatch_metric_alarm" "r_running_tasks" {
  alarm_name          = "${var.project}-r-running-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "R service has no running tasks"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

resource "aws_cloudwatch_metric_alarm" "r_pending_tasks" {
  alarm_name          = "${var.project}-r-pending-tasks"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PendingTaskCount"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "R service has pending tasks (indicates resource constraints)"
  alarm_actions       = []

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.r.name
  }
}

# R Service Dashboard
resource "aws_cloudwatch_dashboard" "r_service" {
  dashboard_name = "${var.project}-r-service-dashboard"

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
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.r.name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.region
          title  = "R Service Resource Utilization"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "RunningTaskCount", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.r.name],
            [".", "PendingTaskCount", ".", ".", ".", "."]
          ]
          period = 60
          stat   = "Average"
          region = var.region
          title  = "R Service Task Status"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          query  = "SOURCE '${local.r_log_group_name}'\n| fields @timestamp, @message\n| filter @message like /ERROR|WARN|CRITICAL/\n| sort @timestamp desc\n| limit 100"
          region = var.region
          title  = "R Service Error Logs"
        }
      }
    ]
  })
}
