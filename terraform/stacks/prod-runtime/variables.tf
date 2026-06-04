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

variable "ui_lambda_memory_size" {
  type        = number
  description = "Memory size in MB for the UI Lambda function"
  default     = 1024
}

variable "ui_lambda_timeout" {
  type        = number
  description = "Timeout in seconds for the UI Lambda function (web tier; long analyses bypass it and hit the R backend directly)"
  default     = 30
}

variable "ui_lambda_log_retention_days" {
  type        = number
  description = "Number of days to retain UI Lambda CloudWatch logs"
  default     = 3
}

variable "lambda_r_backend_function_base_name" {
  type        = string
  description = "The base name of the Lambda function"
  default     = "lambda-r-backend"
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
  description = "Reserved concurrency for Lambda R backend (-1 = unreserved)"
  type        = number
  default     = -1
}

variable "lambda_r_backend_log_retention_days" {
  type        = number
  description = "Number of days to retain Lambda R backend CloudWatch logs"
  default     = 3
}
