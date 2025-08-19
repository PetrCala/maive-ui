locals {
  vpc_id          = data.terraform_remote_state.foundation.outputs.vpc_id
  private_subnets = data.terraform_remote_state.foundation.outputs.private_subnets
  public_subnets  = data.terraform_remote_state.foundation.outputs.public_subnets
  ecr_urls        = data.terraform_remote_state.foundation.outputs.ecr_repository_urls

  ui_port = 3000
  r_port  = 8787

  ui_log_group_name = data.aws_cloudwatch_log_group.ui_logs.name
  r_log_group_name  = data.aws_cloudwatch_log_group.r_logs.name
}

