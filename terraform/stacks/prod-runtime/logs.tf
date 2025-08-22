data "aws_cloudwatch_log_group" "ui_logs" {
  name = "/ecs/${var.project}/react-ui"
}

data "aws_cloudwatch_log_group" "lambda_r_backend_logs" {
  name = "/aws/lambda/${var.project}-lambda-r-backend"
}
