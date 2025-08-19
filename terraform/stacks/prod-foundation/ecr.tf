resource "aws_ecr_repository" "repos" {
  for_each             = toset(var.services)
  name                 = "${var.project}-${each.key}"
  image_tag_mutability = "MUTABLE"

  encryption_configuration { encryption_type = "AES256" }

  image_scanning_configuration { scan_on_push = true }

  tags = { Project = var.project }

  force_delete = true
}

# Keep only the 5 most recent images
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = { type = "expire" }
      }
    ]
  })
}
