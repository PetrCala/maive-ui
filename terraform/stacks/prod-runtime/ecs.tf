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

# Allow tasks to read/write the user-data bucket
resource "aws_iam_policy" "data_bucket_rw" {
  name = "${var.project}-data-bucket-rw"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        Resource = "arn:aws:s3:::${data.terraform_remote_state.foundation.outputs.data_bucket_name}/*"
      },
      {
        Effect   = "Allow",
        Action   = ["s3:ListBucket"],
        Resource = "arn:aws:s3:::${data.terraform_remote_state.foundation.outputs.data_bucket_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "data_bucket_rw_attach" {
  role       = aws_iam_role.task_exec.name
  policy_arn = aws_iam_policy.data_bucket_rw.arn
}

# ---------------- React UI ----------------
resource "aws_ecs_task_definition" "ui" {
  family                   = "${var.project}-ui"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ui_task_cpu
  memory                   = var.ui_task_mem
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.task_exec.arn

  container_definitions = jsonencode([{
    name         = "ui"
    image        = "${local.ecr_urls["react-ui"]}:${var.image_tag}"
    portMappings = [{ containerPort = local.ui_port, protocol = "tcp" }]
    environment = [
      { name = "REACT_APP_API_URL", value = "http://${aws_lb.api.dns_name}" }
    ]
    logConfiguration = {
      logDriver = "awslogs",
      options   = { awslogs-group = "/ecs/${var.project}/react-ui", awslogs-region = var.region, awslogs-stream-prefix = "ecs" }
    }
  }])
}

resource "aws_ecs_service" "ui" {
  name            = "${var.project}-ui"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.ui.arn
  desired_count   = 2
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

# ---------------- Flask API ----------------
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_task_cpu
  memory                   = var.api_task_mem
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.task_exec.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = "${local.ecr_urls["flask-api"]}:${var.image_tag}"
    portMappings = [{ containerPort = local.api_port, protocol = "tcp" }]
    environment = [
      { name = "R_API_URL", value = "http://r:${local.r_port}" }
    ]
    logConfiguration = {
      logDriver = "awslogs",
      options   = { awslogs-group = "/ecs/${var.project}/flask-api", awslogs-region = var.region, awslogs-stream-prefix = "ecs" }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${var.project}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [module.sg_api_tasks.security_group_id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.api_port
  }
  enable_execute_command = true
}

# ---------------- R plumber ----------------
resource "aws_ecs_task_definition" "r" {
  family                   = "${var.project}-r-plumber"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.r_task_cpu
  memory                   = var.r_task_mem
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.task_exec.arn

  container_definitions = jsonencode([{
    name         = "r"
    image        = "${local.ecr_urls["r-plumber"]}:${var.image_tag}"
    portMappings = [{ containerPort = local.r_port, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs",
      options   = { awslogs-group = "/ecs/${var.project}/r-plumber", awslogs-region = var.region, awslogs-stream-prefix = "ecs" }
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
