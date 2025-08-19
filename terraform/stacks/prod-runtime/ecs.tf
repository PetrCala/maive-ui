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
      { name = "NEXT_PUBLIC_R_API_URL", value = "http://r:${local.r_port}" },
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
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [module.sg_r_tasks.security_group_id]
    assign_public_ip = false
  }
  enable_execute_command = true
}
