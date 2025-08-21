# UI-specific IAM role for UI task to invoke Lambda
resource "aws_iam_role" "ui_task" {
  name               = "${var.project}-ui-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks.json
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "ui_task_exec" {
  role       = aws_iam_role.ui_task.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

# Attach SSM policy
resource "aws_iam_role_policy_attachment" "ui_task_ssm" {
  role       = aws_iam_role.ui_task.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Custom policy for Lambda invocation
resource "aws_iam_policy" "ui_task_lambda_invoke" {
  name        = "${var.project}-ui-task-lambda-invoke"
  description = "Allow UI task to invoke Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction",
          "lambda:InvokeFunctionUrl"
        ]
        Resource = [
          aws_lambda_function.r_backend.arn,
          "${aws_lambda_function.r_backend.arn}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ui_task_lambda_invoke" {
  role       = aws_iam_role.ui_task.name
  policy_arn = aws_iam_policy.ui_task_lambda_invoke.arn
}
