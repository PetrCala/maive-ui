module "sg_ui_alb" {
  source      = "terraform-aws-modules/security-group/aws"
  version     = "5.1.0"
  name        = "${var.project}-alb-ui"
  description = "Public ALB for UI"
  vpc_id      = local.vpc_id
  ingress_with_cidr_blocks = [{
    from_port   = local.ui_port,
    to_port     = local.ui_port,
    protocol    = "tcp",
    cidr_blocks = "0.0.0.0/0"
  }]
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

  egress_with_cidr_blocks = [{
    # UI -> API internal ALB
    from_port         = local.api_port
    to_port           = local.api_port
    protocol          = "tcp"
    security_group_id = module.sg_api_alb.security_group_id
  }]
}

module "sg_api_alb" {
  source      = "terraform-aws-modules/security-group/aws"
  version     = "5.1.0"
  name        = "${var.project}-alb-api"
  description = "Internal ALB for Flask API"
  vpc_id      = local.vpc_id

  ingress_with_source_security_group_id = [{
    from_port                = local.api_port
    to_port                  = local.api_port
    protocol                 = "tcp"
    source_security_group_id = module.sg_ui_tasks.security_group_id
  }]

  egress_with_cidr_blocks = [{
    # API -> R tasks
    from_port         = local.r_port
    to_port           = local.r_port
    protocol          = "tcp"
    security_group_id = module.sg_r_tasks.security_group_id
  }]
}

module "sg_api_tasks" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.1.0"
  name    = "${var.project}-api-tasks"
  vpc_id  = local.vpc_id
  ingress_with_source_security_group_id = [{
    from_port                = local.api_port
    to_port                  = local.api_port
    protocol                 = "tcp"
    source_security_group_id = module.sg_api_alb.security_group_id
  }]
  egress_with_cidr_blocks = [{
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
    source_security_group_id = module.sg_api_tasks.security_group_id
  }]
}
