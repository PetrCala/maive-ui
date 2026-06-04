# Pull outputs from prod-foundation
data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "${var.project}-tf-state"
    key    = "prod-foundation.tfstate"
    region = var.region
  }
}

