# Add Lambda function URL output
output "lambda_r_backend_url" {
  description = "URL of the Lambda R backend function"
  value       = aws_lambda_function_url.r_backend.function_url
}

# UI ALB DNS name for reliable access
output "ui_alb_dns_name" {
  description = "DNS name of the public UI ALB"
  value       = aws_lb.ui.dns_name
}

# UI Lambda Function URL (Cloudflare origin for the serverless UI)
output "ui_lambda_url" {
  description = "Function URL of the UI Lambda"
  value       = aws_lambda_function_url.ui.function_url
}
