# Execution role shared by all tasks
data "aws_iam_policy" "ecs_task_execution" {
  arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_tasks" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_exec" {
  name               = "${var.project}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks.json
}

resource "aws_iam_role_policy_attachment" "task_exec" {
  role       = aws_iam_role.task_exec.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

resource "aws_iam_role_policy_attachment" "task_exec_ssm" {
  role       = aws_iam_role.task_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# New role for UI task to invoke Lambda
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
