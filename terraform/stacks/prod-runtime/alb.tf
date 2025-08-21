# Public ALB for UI
resource "aws_lb" "ui" {
  name               = "${var.project}-ui-alb"
  load_balancer_type = "application"
  security_groups    = [module.sg_ui_alb.security_group_id]
  subnets            = local.public_subnets
  enable_http2       = true
  idle_timeout       = 300
}

resource "aws_lb_target_group" "ui" {
  name                 = "${var.project}-ui-tg"
  port                 = local.ui_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = local.vpc_id
  deregistration_delay = 300
  health_check {
    path                = "/"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }
}

# HTTP listener - redirect to HTTPS when certificate exists, forward when it doesn't
resource "aws_lb_listener" "ui_http" {
  count             = var.certificate_arn != "" ? 1 : 0
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

# HTTPS listener - only create if certificate is provided
resource "aws_lb_listener" "ui_https" {
  count             = var.certificate_arn != "" ? 1 : 0
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

# HTTP listener fallback when no certificate - forward directly to target group
resource "aws_lb_listener" "ui_http_forward" {
  count             = var.certificate_arn == "" ? 1 : 0
  load_balancer_arn = aws_lb.ui.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui.arn
  }
}

# WAF – Enhanced security rules
resource "aws_wafv2_web_acl" "ui_acl" {
  name        = "${var.project}-ui-waf"
  scope       = "REGIONAL"
  description = "Enhanced security for public UI - optimized for data processing apps"
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

  rule {
    name     = "BlockSQLInjection"
    priority = 2
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "sqlInjection"
    }
    override_action {
      count {}
    }
  }

  rule {
    name     = "BlockAnonymousIP"
    priority = 3
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "anonymousIP"
    }
    override_action {
      count {}
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
