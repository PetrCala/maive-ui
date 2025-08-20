module "sg_ui_alb" {
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
    protocol    = "-1",
    cidr_blocks = "0.0.0.0/0"
  }]
}

module "sg_ui_tasks" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.1.0"
  name    = "${var.project}-ui-tasks"
  vpc_id  = local.vpc_id

  ingress_with_source_security_group_id = [{
    from_port                = local.ui_port
    to_port                  = local.ui_port
    protocol                 = "tcp"
    source_security_group_id = module.sg_ui_alb.security_group_id
  }]

  egress_with_source_security_group_id = [{
    # UI -> R ALB (on port 8080)
    from_port                = 8080
    to_port                  = 8080
    protocol                 = "tcp"
    source_security_group_id = module.sg_r_alb.security_group_id
  }]

  egress_with_cidr_blocks = [{
    # Allow outbound internet access for ECR, CloudWatch, etc.
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = "0.0.0.0/0"
  }]
}

module "sg_r_alb" {
  source      = "terraform-aws-modules/security-group/aws"
  version     = "5.1.0"
  name        = "${var.project}-alb-r"
  description = "Internal ALB for R"
  vpc_id      = local.vpc_id

  ingress_with_source_security_group_id = [{
    description              = "Allow traffic from UI ECS task"
    from_port                = 8080
    to_port                  = 8080
    protocol                 = "tcp"
    source_security_group_id = module.sg_ui_tasks.security_group_id
  }]

  egress_with_cidr_blocks = [{
    # R -> R tasks
    from_port         = local.r_port
    to_port           = local.r_port
    protocol          = "tcp"
    security_group_id = module.sg_r_tasks.security_group_id
  }]
}

module "sg_r_tasks" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.1.0"
  name    = "${var.project}-r-tasks"
  vpc_id  = local.vpc_id
  ingress_with_source_security_group_id = [{
    from_port                = local.r_port
    to_port                  = local.r_port
    protocol                 = "tcp"
    source_security_group_id = module.sg_r_alb.security_group_id
  }]

  egress_with_cidr_blocks = [{
    # Allow outbound internet access for ECR, CloudWatch, etc.
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = "0.0.0.0/0"
  }]
}
