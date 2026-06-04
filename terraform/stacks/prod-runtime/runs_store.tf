# Async runs store. Holds each run's status + full result (~50KB) inline, with
# a 48h TTL acting as a pickup buffer (the durable history lives client-side).
resource "aws_dynamodb_table" "runs" {
  name         = "${var.project}-runs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Project = var.project
  }
}
