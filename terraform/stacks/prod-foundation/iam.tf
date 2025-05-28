data "aws_caller_identity" "current" {}

resource "aws_iam_role" "gha_terraform" {
  name = "gha-terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/${var.release_branch}"
          }
        }
      }
    ]
  })

  tags = {
    Project = var.github_repo
  }
}

resource "aws_iam_role_policy" "gha_terraform_policy" {
  name = "gha-terraform-inline"
  role = aws_iam_role.gha_terraform.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid : "VPCResources",
        Effect : "Allow",
        Action : [
          "ec2:CreateVpc",
          "ec2:CreateSubnet",
          "ec2:CreateRouteTable",
          "ec2:AssociateRouteTable",
          "ec2:CreateInternetGateway",
          "ec2:AttachInternetGateway",
          "ec2:CreateNatGateway",
          "ec2:AllocateAddress",
          "ec2:CreateSecurityGroup",
          "ec2:*VpcEndpoint*",
          "ec2:Describe*"
        ],
        Resource : "*"
      },
      {
        Sid : "ECS",
        Effect : "Allow",
        Action : [
          "ecs:*",
          "iam:PassRole"
        ],
        Resource : "*"
      },
      {
        Sid : "ECR",
        Effect : "Allow",
        Action : [
          "ecr:*"
        ],
        Resource : "*"
      },
      {
        Sid : "S3AndLogs",
        Effect : "Allow",
        Action : [
          "s3:*",
          "logs:*"
        ],
        Resource : "*"
      },
      {
        Sid : "IAMLimited",
        Effect : "Allow",
        Action : [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:PassRole",
          "iam:AttachRolePolicy",
          "iam:PutRolePolicy",
          "iam:CreatePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:List*"
        ],
        Resource : "*"
      },
      {
        Sid : "CloudWatchEvents",
        Effect : "Allow",
        Action : [
          "events:*",
          "cloudwatch:*"
        ],
        Resource : "*"
      },
      {
        Sid : "Tagging",
        Effect : "Allow",
        Action : [
          "tag:*"
        ],
        Resource : "*"
      }
    ]
  })
}
