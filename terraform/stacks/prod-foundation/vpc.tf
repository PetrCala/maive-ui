variable "trusted_office_cidr" {
  description = "CIDR block that is allowed to reach the private subnets (e.g. VPN / office)."
  type        = string
  default     = "80.188.248.78/32" # Temporary
}

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

  # Allow only HTTPS from the trusted network
  private_inbound_acl_rules = [
    {
      rule_number = 100
      action      = "allow"
      protocol    = "tcp"
      from_port   = 443
      to_port     = 443
      cidr_block  = var.trusted_office_cidr
    },
    # Optional: allow SSH for bastion / admin
    {
      rule_number = 110
      action      = "allow"
      protocol    = "tcp"
      from_port   = 22
      to_port     = 22
      cidr_block  = var.trusted_office_cidr
    },
    # 🔒 Everything else (IPv4) is denied
    {
      rule_number = 32760 # < 32767 catch-all
      action      = "deny"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      cidr_block  = "0.0.0.0/0"
    }
  ]

  # Outbound: allow anything the workload initiates
  private_outbound_acl_rules = [
    {
      rule_number = 100
      action      = "allow"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      cidr_block  = "0.0.0.0/0"
    }
  ]
}


