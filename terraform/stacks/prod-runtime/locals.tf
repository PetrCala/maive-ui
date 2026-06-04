locals {
  ecr_urls = data.terraform_remote_state.foundation.outputs.ecr_repository_urls

  lambda_r_backend_function_name = "${var.project}-${var.lambda_r_backend_function_base_name}"

  lambda_r_backend_log_group_name = data.aws_cloudwatch_log_group.lambda_r_backend_logs.name
}

