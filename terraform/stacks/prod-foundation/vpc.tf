module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name                 = "${var.project}-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = ["eu-central-1a", "eu-central-1b"]
  public_subnets       = ["10.0.1.0/24", "10.0.2.0/24"]
  enable_nat_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Project     = var.project
    Environment = "production"
    CostCenter  = "engineering"
    ManagedBy   = "terraform"
  }
}


