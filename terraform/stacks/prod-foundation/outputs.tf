output "ecr_repository_urls" {
  value = { for k, repo in aws_ecr_repository.repos : k => repo.repository_url }
}

output "data_bucket_name" {
  value = aws_s3_bucket.data.bucket
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
