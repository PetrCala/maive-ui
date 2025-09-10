resource "aws_ecr_repository" "repos" {
  for_each             = toset(var.services)
  name                 = "${var.project}-${each.key}"
  image_tag_mutability = "MUTABLE"

  encryption_configuration { encryption_type = "AES256" }

  image_scanning_configuration { scan_on_push = true }

  tags = { Project = var.project }

  force_delete = true
}

resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last 3 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = { type = "expire" }
      }
    ]
  })
}

# Explicit ECR repository for rlib with immutable tags
resource "aws_ecr_repository" "rlib" {
  name                 = "${var.project}-rlib"
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration { encryption_type = "AES256" }

  image_scanning_configuration { scan_on_push = true }

  tags = { Project = var.project }

  force_delete = true
}


# Lifecycle policy for rlib repository
resource "aws_ecr_lifecycle_policy" "rlib_cleanup" {
  repository = aws_ecr_repository.rlib.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last 2 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 2
        }
        action = { type = "expire" }
      }
    ]
  })
}
