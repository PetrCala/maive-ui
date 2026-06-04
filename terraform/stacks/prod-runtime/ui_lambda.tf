# UI (Next.js) on Lambda via the AWS Lambda Web Adapter.
# Exposed through a public Function URL; Cloudflare (CDN/TLS/WAF) is the only
# thing in front of it and rewrites the Host/SNI to the .on.aws origin.

resource "aws_iam_role" "ui_lambda" {
  name = "${var.project}-ui-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ui_lambda_basic" {
  role       = aws_iam_role.ui_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# /api/system-status reads the status-banner SSM parameters server-side.
resource "aws_iam_policy" "ui_lambda_ssm_read" {
  name        = "${var.project}-ui-lambda-ssm-read"
  description = "Allow the UI Lambda to read the status-banner SSM parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = [
          aws_ssm_parameter.ui_unstable_banner_enabled.arn,
          aws_ssm_parameter.ui_unstable_banner_message.arn,
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ui_lambda_ssm_read" {
  role       = aws_iam_role.ui_lambda.name
  policy_arn = aws_iam_policy.ui_lambda_ssm_read.arn
}

# Explicit log group so retention is bounded (Lambda otherwise auto-creates one
# that never expires).
resource "aws_cloudwatch_log_group" "ui_lambda" {
  name              = "/aws/lambda/${var.project}-ui"
  retention_in_days = var.ui_lambda_log_retention_days
  tags              = { Project = var.project }
}

resource "aws_lambda_function" "ui" {
  function_name = "${var.project}-ui"
  role          = aws_iam_role.ui_lambda.arn
  timeout       = var.ui_lambda_timeout
  memory_size   = var.ui_lambda_memory_size

  package_type = "Image"
  image_uri    = "${local.ecr_urls["react-ui"]}:${var.image_tag}"

  environment {
    variables = {
      NEXT_PUBLIC_R_API_URL                = aws_lambda_function_url.r_backend.function_url
      STATUS_BANNER_ENABLED_PARAMETER_NAME = aws_ssm_parameter.ui_unstable_banner_enabled.name
      STATUS_BANNER_MESSAGE_PARAMETER_NAME = aws_ssm_parameter.ui_unstable_banner_message.name
      STATUS_BANNER_AWS_REGION             = var.region
    }
  }

  depends_on = [aws_cloudwatch_log_group.ui_lambda]

  tags = {
    Project = var.project
  }
}

# Public Function URL; Cloudflare will be the only thing in front of it.
resource "aws_lambda_function_url" "ui" {
  function_name      = aws_lambda_function.ui.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "ui_public_invoke" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.ui.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
