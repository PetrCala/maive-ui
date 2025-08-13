output "ui_alb_dns_name" {
  description = "DNS name of the public UI ALB"
  value       = aws_lb.ui.dns_name
}

output "r_alb_dns_name" {
  description = "DNS name of the internal R ALB"
  value       = aws_lb.r.dns_name
}
