# Pull outputs from prod-foundation
data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "${var.project}-tf-state"
    key    = "${var.project}/prod-foundation.tfstate"
    region = var.region
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${var.project}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "ui_logs" {
  name              = "/ecs/${var.project}/react-ui"
  retention_in_days = 7 # Reduced retention for cost savings
}

resource "aws_cloudwatch_log_group" "r_logs" {
  name              = "/ecs/${var.project}/r-plumber"
  retention_in_days = 7 # Reduced retention for cost savings
}
