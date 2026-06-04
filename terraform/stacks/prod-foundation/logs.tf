resource "aws_cloudwatch_log_group" "lambda_default" {
  name              = "/aws/lambda/${var.project}-lambda-r-backend"
  retention_in_days = var.log_retention_days
  tags              = { Project = var.project }
}
