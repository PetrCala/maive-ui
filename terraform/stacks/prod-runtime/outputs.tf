# Add Lambda function URL output
output "lambda_r_backend_url" {
  description = "URL of the Lambda R backend function"
  value       = aws_lambda_function_url.r_backend.function_url
}

# UI Lambda Function URL (Cloudflare origin for the serverless UI)
output "ui_lambda_url" {
  description = "Function URL of the UI Lambda"
  value       = aws_lambda_function_url.ui.function_url
}
