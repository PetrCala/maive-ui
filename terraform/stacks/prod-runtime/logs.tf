data "aws_cloudwatch_log_group" "lambda_r_backend_logs" {
  name = "/aws/lambda/${var.project}-lambda-r-backend"
}
