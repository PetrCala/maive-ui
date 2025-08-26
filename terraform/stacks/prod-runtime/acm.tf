resource "aws_acm_certificate" "ui" {
  domain_name               = var.domain_name
  subject_alternative_names = var.additional_domains
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project}-ui-cert"
    Project     = var.project
  }
}