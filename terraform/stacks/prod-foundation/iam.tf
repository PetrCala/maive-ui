data "aws_caller_identity" "current" {}

# OIDC Provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
    "a031c46782e6e6c662c2c87c76da9aa62ccabd8e"
  ]

  tags = {
    Project = var.github_repo
  }
}

resource "aws_iam_role" "gha_terraform" {
  name = "gha-terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          },
          StringEquals = {
            "token.actions.githubusercontent.com:iss" = "https://token.actions.githubusercontent.com"
          },
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
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
          "ec2:Describe*",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:UpdateSecurityGroupRuleDescriptionsIngress",
          "ec2:UpdateSecurityGroupRuleDescriptionsEgress"
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
      },
      {
        Sid : "STS",
        Effect : "Allow",
        Action : [
          "sts:AssumeRole",
          "sts:GetCallerIdentity"
        ],
        Resource : "*"
      },
      {
        Sid : "ELBv2",
        Effect : "Allow",
        Action : [
          "elasticloadbalancing:*"
        ],
        Resource : "*"
      },
      {
        Sid : "WAFv2",
        Effect : "Allow",
        Action : [
          "wafv2:*"
        ],
        Resource : "*"
      },
      {
        Sid : "CloudWatchLogs",
        Effect : "Allow",
        Action : [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
          "logs:DeleteRetentionPolicy"
        ],
        Resource : "*"
      }
    ]
  })
}
