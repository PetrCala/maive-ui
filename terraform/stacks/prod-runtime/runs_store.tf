# Async runs store. Holds each run's status + full result (~50KB) inline, with
# a 48h TTL acting as a pickup buffer (the durable history lives client-side).
# Also holds one persistent record per distinct input (#529), keyed
# jobId = "input#<sha256>", with a 30 day TTL: input hash, k, method, outcome,
# duration, timestamps and run/dedup counters, doubling as the dedup lookup.
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
