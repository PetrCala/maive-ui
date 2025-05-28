terraform {
  required_version = "~> 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  backend "s3" {
    bucket         = "my-tf-state" # <- already exists from bootstrap
    key            = "prod-foundation.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "my-tf-locks"
  }
}

provider "aws" {
  region = var.region
}
