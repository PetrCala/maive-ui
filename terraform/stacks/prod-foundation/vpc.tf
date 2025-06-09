module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name                 = "${var.project}-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = ["eu-central-1a", "eu-central-1b"]
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets       = [] # later enable ["10.0.101.0/24", "10.0.102.0/24"]
  enable_nat_gateway   = false
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Project = var.project }
}

# Gateway endpoint so S3 traffic stays inside the VPC
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = module.vpc.private_route_table_ids
  tags              = { Name = "${var.project}-s3-endpoint" }
}
