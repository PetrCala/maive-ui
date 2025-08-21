variable "account_id" {
  type = string
}

variable "region" {
  type = string
}

variable "project" {
  type = string
}

variable "email" {
  type = string
}

variable "image_tag" {
  type        = string
  description = "The tag of the ECR images"
}

variable "ui_task_cpu" {
  type        = number
  description = "The CPU of the UI task"
  default     = 256
}

variable "ui_task_mem" {
  type        = number
  description = "The memory of the UI task"
  default     = 512 # Allow overhead for data processing
}

variable "ui_desired_count" {
  type        = number
  description = "Number of UI tasks to run"
  default     = 1
}

variable "certificate_arn" {
  type        = string
  description = "ARN of the SSL certificate for HTTPS. If empty, the ALB will use HTTP only (not recommended for production)"
  default     = ""
}
