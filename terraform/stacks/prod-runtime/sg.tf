# UI ALB Security Group (conditional based on use_secure_setup)
module "sg_ui_alb" {
  count       = var.use_secure_setup ? 1 : 0
  source      = "terraform-aws-modules/security-group/aws"
  version     = "5.1.0"
  name        = "${var.project}-alb-ui"
  description = "Public ALB for UI"
  vpc_id      = local.vpc_id
  ingress_with_cidr_blocks = [
    {
      from_port   = 80,
      to_port     = 80,
      protocol    = "tcp",
      cidr_blocks = "0.0.0.0/0"
    },
    {
      from_port   = 443,
      to_port     = 443,
      protocol    = "tcp",
      cidr_blocks = "0.0.0.0/0"
    }
  ]
  egress_with_cidr_blocks = [{
    from_port   = 0,
    to_port     = 0,
    protocol    = "-1"
    cidr_blocks = "0.0.0.0/0"
  }]
}

# UI Tasks Security Group - Secure Setup (ALB access only)
module "sg_ui_tasks_secure" {
  count   = var.use_secure_setup ? 1 : 0
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.1.0"
  name    = "${var.project}-ui-tasks-secure"
  vpc_id  = local.vpc_id

  ingress_with_source_security_group_id = [{
    from_port                = local.ui_port
    to_port                  = local.ui_port
    protocol                 = "tcp"
    source_security_group_id = module.sg_ui_alb[0].security_group_id
  }]

  egress_with_cidr_blocks = [{
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = "0.0.0.0/0"
  }]
}

# UI Tasks Security Group - Minimal Setup (direct internet access)
module "sg_ui_tasks_minimal" {
  count   = var.use_secure_setup ? 0 : 1
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.1.0"
  name    = "${var.project}-ui-tasks-minimal"
  vpc_id  = local.vpc_id

  ingress_with_cidr_blocks = [{
    description = "Allow HTTP access from anywhere (minimal setup)"
    from_port   = local.ui_port
    to_port     = local.ui_port
    protocol    = "tcp"
    cidr_blocks = "0.0.0.0/0"
  }]

  egress_with_cidr_blocks = [{
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = "0.0.0.0/0"
  }]
}
