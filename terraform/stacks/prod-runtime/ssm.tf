resource "aws_ssm_parameter" "ui_unstable_banner_enabled" {
  name        = "/${var.project}/ui/unstable_banner_enabled"
  description = "Controls whether the MAIVE UI shows the unstable release banner."
  type        = "String"
  value       = "false"
  overwrite   = true
}

resource "aws_ssm_parameter" "ui_unstable_banner_message" {
  name        = "/${var.project}/ui/unstable_banner_message"
  description = "Message displayed when the unstable release banner is enabled."
  type        = "String"
  value       = "The current release may be unstable. Please proceed with caution."
  overwrite   = true

  lifecycle {
    ignore_changes = [value]
  }
}
