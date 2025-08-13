output "ecr_repository_urls" {
  value = { for k, repo in aws_ecr_repository.repos : k => repo.repository_url }
}


output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnets" {
  value = module.vpc.private_subnets
}

output "public_subnets" {
  value = module.vpc.public_subnets
}
