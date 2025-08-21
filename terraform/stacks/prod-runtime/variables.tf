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

variable "lambda_r_backend_memory_size" {
  type        = number
  description = "Memory size in MB for the Lambda R backend function"
  default     = 1024
}

variable "lambda_r_backend_timeout" {
  type        = number
  description = "Timeout in seconds for the Lambda R backend function"
  default     = 600
}

variable "lambda_r_backend_reserved_concurrency" {
  type        = number
  description = "Reserved concurrency for the Lambda R backend function (0 = no limit)"
  default     = 0
}

variable "lambda_r_backend_log_retention_days" {
  type        = number
  description = "Number of days to retain Lambda R backend CloudWatch logs"
  default     = 7
}
