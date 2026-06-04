# Async-runs orchestrator: SQS-triggered Node Lambda that runs queued jobs
# against the R backend Function URL and writes status + results to DynamoDB.
# Packaged as a zip built in CI from apps/orchestrator (esbuild -> dist/).

data "archive_file" "orchestrator" {
  type        = "zip"
  source_dir  = "${path.module}/../../../apps/orchestrator/dist"
  output_path = "${path.module}/orchestrator.zip"
}

resource "aws_iam_role" "orchestrator" {
  name = "${var.project}-orchestrator-role"

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

resource "aws_iam_role_policy_attachment" "orchestrator_basic" {
  role       = aws_iam_role.orchestrator.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "orchestrator" {
  name        = "${var.project}-orchestrator-policy"
  description = "Allow the orchestrator to consume the runs queue and update the runs table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = aws_sqs_queue.runs.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.runs.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "orchestrator" {
  role       = aws_iam_role.orchestrator.name
  policy_arn = aws_iam_policy.orchestrator.arn
}

resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/aws/lambda/${var.project}-orchestrator"
  retention_in_days = var.ui_lambda_log_retention_days
  tags              = { Project = var.project }
}

resource "aws_lambda_function" "orchestrator" {
  function_name    = "${var.project}-orchestrator"
  role             = aws_iam_role.orchestrator.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 660 # > R Lambda timeout (600s)
  memory_size      = 256
  filename         = data.archive_file.orchestrator.output_path
  source_code_hash = data.archive_file.orchestrator.output_base64sha256

  environment {
    variables = {
      RUNS_TABLE_NAME = aws_dynamodb_table.runs.name
      R_API_URL       = aws_lambda_function_url.r_backend.function_url
    }
  }

  depends_on = [aws_cloudwatch_log_group.orchestrator]
  tags       = { Project = var.project }
}

# SQS -> orchestrator. maximum_concurrency caps how many queued runs fan out to
# the R backend at once (bounds cost without throttling synchronous browser
# calls, which is why the R Lambda itself stays unreserved).
resource "aws_lambda_event_source_mapping" "orchestrator" {
  event_source_arn = aws_sqs_queue.runs.arn
  function_name    = aws_lambda_function.orchestrator.arn
  batch_size       = 1
  enabled          = true

  scaling_config {
    maximum_concurrency = 5
  }
}
