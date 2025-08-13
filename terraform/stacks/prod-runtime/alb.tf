# Public ALB for UI
resource "aws_lb" "ui" {
  name               = "${var.project}-ui-alb"
  load_balancer_type = "application"
  security_groups    = [module.sg_ui_alb.security_group_id]
  subnets            = local.public_subnets
  enable_http2       = true
}

resource "aws_lb_target_group" "ui" {
  name        = "${var.project}-ui-tg"
  port        = local.ui_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = local.vpc_id
  health_check {
    path = "/"
    port = "traffic-port"
  }
}

resource "aws_lb_listener" "ui_http" {
  load_balancer_arn = aws_lb.ui.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "ui_https" {
  load_balancer_arn = aws_lb.ui.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui.arn
  }
}

# Internal ALB for R
resource "aws_lb" "r" {
  name               = "${var.project}-r-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [module.sg_r_alb.security_group_id]
  subnets            = local.private_subnets
}

resource "aws_lb_target_group" "r" {
  name        = "${var.project}-r-tg"
  port        = local.r_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = local.vpc_id
  health_check {
    path = "/health"
    port = "traffic-port"
  }
}

resource "aws_lb_listener" "r_http" {
  load_balancer_arn = aws_lb.r.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.r.arn
  }
}

# WAF – simple rate-limit
resource "aws_wafv2_web_acl" "ui_acl" {
  name        = "${var.project}-ui-waf"
  scope       = "REGIONAL"
  description = "Rate-limit public UI"
  default_action {
    allow {}
  }

  rule {
    name     = "RateLimit1K"
    priority = 1
    statement {
      rate_based_statement {
        limit              = 1000 # requests per 5 min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "rateLimit"
    }
    action {
      block {}
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    sampled_requests_enabled   = false
    metric_name                = "uiWebACL"
  }
}

resource "aws_wafv2_web_acl_association" "ui_acl_assoc" {
  resource_arn = aws_lb.ui.arn
  web_acl_arn  = aws_wafv2_web_acl.ui_acl.arn
}
