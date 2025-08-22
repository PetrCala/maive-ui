# Lambda-based UI alternative for very low usage scenarios
# This approach can reduce costs from ~$40/month to ~$5-10/month

# Lambda function for serving the UI
resource "aws_lambda_function" "ui" {
  count = var.enable_lambda_ui ? 1 : 0
  
  function_name = "${var.project}-ui"
  role          = aws_iam_role.lambda_ui.arn
  timeout       = 30
  memory_size   = 512

  package_type = "Image"
  image_uri    = "${data.aws_ecr_repository.react_ui.repository_url}:${var.image_tag}"

  environment {
    variables = {
      NODE_ENV = "production"
      NEXT_PUBLIC_R_API_URL = aws_lambda_function_url.r_backend.function_url
    }
  }

  tags = {
    Project = var.project
  }
}

# IAM role for Lambda UI
resource "aws_iam_role" "lambda_ui" {
  count = var.enable_lambda_ui ? 1 : 0
  
  name = "${var.project}-lambda-ui-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_ui_basic" {
  count = var.enable_lambda_ui ? 1 : 0
  
  role       = aws_lambda_role.lambda_ui[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function URL for direct HTTP access
resource "aws_lambda_function_url" "ui" {
  count = var.enable_lambda_ui ? 1 : 0
  
  function_name      = aws_lambda_function.ui[0].function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# Lambda@Edge function for CloudFront (alternative approach)
resource "aws_lambda_function" "ui_edge" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  function_name = "${var.project}-ui-edge"
  role          = aws_iam_role.lambda_edge.arn
  timeout       = 5
  memory_size   = 128

  package_type = "Image"
  image_uri    = "${data.aws_ecr_repository.react_ui.repository_url}:${var.image_tag}"

  environment {
    variables = {
      NODE_ENV = "production"
      NEXT_PUBLIC_R_API_URL = aws_lambda_function_url.r_backend.function_url
    }
  }

  tags = {
    Project = var.project
  }
}

# IAM role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  name = "${var.project}-lambda-edge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "edgelambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudFront distribution for Lambda@Edge
resource "aws_cloudfront_distribution" "ui" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  enabled             = true
  is_ipv6_enabled    = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # Use only North America and Europe

  origin {
    domain_name = aws_s3_bucket.ui_static[0].bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.ui_static[0].id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.ui[0].cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.ui_static[0].id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = "${aws_lambda_function.ui_edge[0].arn}:${aws_lambda_function.ui_edge[0].version}"
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Handle SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = "200"
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project = var.project
  }
}

# S3 bucket for static assets (when using Lambda@Edge)
resource "aws_s3_bucket" "ui_static" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  bucket = "${var.project}-ui-static-${random_string.bucket_suffix[0].result}"
  acl    = "private"

  versioning {
    enabled = true
  }

  tags = {
    Project = var.project
  }
}

# Random string for unique bucket names
resource "random_string" "bucket_suffix" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  length  = 8
  special = false
  upper   = false
}

# CloudFront origin access identity
resource "aws_cloudfront_origin_access_identity" "ui" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  comment = "OAI for ${var.project} UI"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "ui_static" {
  count = var.enable_lambda_edge_ui ? 1 : 0
  
  bucket = aws_s3_bucket.ui_static[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.ui[0].iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.ui_static[0].arn}/*"
      }
    ]
  })
}

# Monitoring for Lambda UI
resource "aws_cloudwatch_metric_alarm" "lambda_ui_errors" {
  count = var.enable_lambda_ui ? 1 : 0
  
  alarm_name          = "${var.project}-lambda-ui-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Lambda UI has errors"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.ui[0].function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_ui_duration" {
  count = var.enable_lambda_ui ? 1 : 0
  
  alarm_name          = "${var.project}-lambda-ui-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000"  # 5 seconds
  alarm_description   = "Lambda UI response time is too high"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.ui[0].function_name
  }
}
