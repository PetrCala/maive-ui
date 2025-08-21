output "ui_alb_dns_name" {
  description = "DNS name of the public UI ALB"
  value       = aws_lb.ui.dns_name
}

output "r_alb_dns_name" {
  description = "DNS name of the internal R ALB"
  value       = aws_lb.r.dns_name
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for monitoring"
  value       = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${var.project}-dashboard"
}

output "lambda_r_backend_url" {
  description = "URL of the Lambda R backend function"
  value       = aws_lambda_function_url.r_backend.url
}
