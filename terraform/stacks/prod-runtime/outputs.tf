output "ui_alb_dns_name" {
  description = "DNS name of the UI ALB (secure setup)"
  value       = var.use_secure_setup ? aws_lb.ui[0].dns_name : null
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for monitoring"
  value       = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${var.project}-dashboard"
}

output "lambda_r_backend_url" {
  description = "URL of the Lambda R backend function"
  value       = aws_lambda_function_url.r_backend.url
}

output "ui_ecs_public_ips" {
  description = "Public IPs of the UI ECS tasks for direct access (minimal setup)"
  value       = var.use_secure_setup ? null : "Access UI directly via ECS public IPs (port ${local.ui_port})"
}

output "setup_type" {
  description = "Current setup type being used"
  value       = var.use_secure_setup ? "secure" : "minimal"
}
