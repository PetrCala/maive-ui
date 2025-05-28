resource "aws_cloudwatch_log_group" "service" {
  for_each          = toset(var.services)
  name              = "/ecs/${var.project}/${each.key}"
  retention_in_days = var.log_retention_days
  tags              = { Project = var.project }
}
