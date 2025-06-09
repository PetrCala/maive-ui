# Disable public ALB for now

# Public ALB for UI
# resource "aws_lb" "ui" {
#   name               = "${var.project}-ui-alb"
#   load_balancer_type = "application"
#   security_groups    = [module.sg_ui_alb.security_group_id]
#   subnets            = local.public_subnets
#   enable_http2       = true
# }

# resource "aws_lb_target_group" "ui" {
#   name        = "${var.project}-ui-tg"
#   port        = local.ui_port
#   protocol    = "HTTP"
#   target_type = "ip"
#   vpc_id      = local.vpc_id
#   health_check {
#     path = "/"
#     port = "traffic-port"
#   }
# }

# resource "aws_lb_listener" "ui_http" {
#   load_balancer_arn = aws_lb.ui.arn
#   port              = 80
#   protocol          = "HTTP"
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.ui.arn
#   }
# }

# Internal ALB for API
resource "aws_lb" "api" {
  name               = "${var.project}-api-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [module.sg_api_alb.security_group_id]
  subnets            = local.private_subnets
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project}-api-tg"
  port        = local.api_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = local.vpc_id
  health_check {
    path = "/health"
    port = "traffic-port"
  }
}

resource "aws_lb_listener" "api_http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# WAF – simple rate-limit
# resource "aws_wafv2_web_acl" "ui_acl" {
#   name        = "${var.project}-ui-waf"
#   scope       = "REGIONAL"
#   description = "Rate-limit public UI"
#   default_action {
#     allow {}
#   }

#   rule {
#     name     = "RateLimit2K"
#     priority = 1
#     statement {
#       rate_based_statement {
#         limit              = 2000 # requests per 5 min
#         aggregate_key_type = "IP"
#       }
#     }
#     visibility_config {
#       cloudwatch_metrics_enabled = true
#       sampled_requests_enabled   = true
#       metric_name                = "rateLimit"
#     }
#     action {
#       block {}
#     }
#   }

#   visibility_config {
#     cloudwatch_metrics_enabled = true
#     sampled_requests_enabled   = false
#     metric_name                = "uiWebACL"
#   }
# }

# resource "aws_wafv2_web_acl_association" "ui_acl_assoc" {
#   resource_arn = aws_lb.ui.arn
#   web_acl_arn  = aws_wafv2_web_acl.ui_acl.arn
# }
