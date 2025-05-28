resource "aws_s3_bucket" "data" {
  bucket        = "${var.project}-user-data"
  force_destroy = true
  tags          = { Project = var.project }
}

# SSE, no versioning, short-lived objects
resource "aws_s3_bucket_server_side_encryption_configuration" "sse" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "ttl" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "expire-short-lived-data"
    status = "Enabled"

    filter {} # This applies the rule to all objects in the bucket

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ‼️ Bucket policy – only allow access **through the VPC endpoint**
resource "aws_s3_bucket_policy" "restrict_to_vpc" {
  bucket = aws_s3_bucket.data.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowViaEndpoint"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource  = ["${aws_s3_bucket.data.arn}/*"]
        Condition = {
          StringEquals = {
            "aws:SourceVpce" = aws_vpc_endpoint.s3.id
          }
        }
      },
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = ["${aws_s3_bucket.data.arn}/*"]
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      }
    ]
  })
}
