locals {
  vpc_id          = data.terraform_remote_state.foundation.outputs.vpc_id
  private_subnets = data.terraform_remote_state.foundation.outputs.private_subnets
  public_subnets  = data.terraform_remote_state.foundation.outputs.public_subnets
  ecr_urls        = data.terraform_remote_state.foundation.outputs.ecr_repository_urls
  data_bucket     = data.terraform_remote_state.foundation.outputs.data_bucket_name

  ui_port  = 3000
  api_port = 8080
  r_port   = 8787
}

