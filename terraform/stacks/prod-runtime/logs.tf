data "aws_cloudwatch_log_group" "ui_logs" {
  name = "/ecs/${var.project}/react-ui"
}

data "aws_cloudwatch_log_group" "r_logs" {
  name = "/ecs/${var.project}/r-plumber"
}
