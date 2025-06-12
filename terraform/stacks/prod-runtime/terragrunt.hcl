locals {
  account_id=get_env("TF_VAR_account_id")
  region=get_env("TF_VAR_region")
  project=get_env("TF_VAR_project")
  email=get_env("TF_VAR_email")
  tfstate_name="${local.project}-tf-state"
  image_tag=get_env("TF_VAR_image_tag")
  key = "${local.project}/prod-runtime.tfstate"
}

inputs = {
  account_id = local.account_id
  region = local.region
  project = local.project
  email = local.email
  tfstate_name = local.tfstate_name
  image_tag = local.image_tag
  key = local.key
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    bucket = local.tfstate_name
    key = local.key
    region = local.region
    use_lockfile = true
    encrypt = true
  }
}

// Generates a versions.tf file
generate "versions" {
  path = "versions.tf"
  if_exists = "overwrite_terragrunt"
  contents = <<EOF
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  required_version = "~> 1.12"
}
EOF
}

generate "provider" {
  path = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents = <<EOF
provider "aws" {
  region = var.region
}
EOF
}