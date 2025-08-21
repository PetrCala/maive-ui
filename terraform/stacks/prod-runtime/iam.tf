# Get current AWS account ID
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "ui_task" {
  name               = "${var.project}-ui-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks.json
}

resource "aws_iam_role_policy_attachment" "ui_task_exec" {
  role       = aws_iam_role.ui_task.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

resource "aws_iam_role_policy_attachment" "ui_task_ssm" {
  role       = aws_iam_role.ui_task.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

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
          "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.project}-${var.lambda_r_backend_function_base_name}",
          "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.project}-${var.lambda_r_backend_function_base_name}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ui_task_lambda_invoke" {
  role       = aws_iam_role.ui_task.name
  policy_arn = aws_iam_policy.ui_task_lambda_invoke.arn
}
