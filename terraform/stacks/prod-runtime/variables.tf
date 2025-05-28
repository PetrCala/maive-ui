variable "aws_account_id" {
  type        = string
  description = "The AWS account ID"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "project" {
  type    = string
  default = "maive"
}

variable "image_tag" {
  type        = string
  description = "The tag of the ECR images"
}

# pick the memory/CPU that fits your containers
variable "ui_task_cpu" {
  type        = number
  description = "The CPU of the UI task"
  default     = 512
}

variable "ui_task_mem" {
  type        = number
  description = "The memory of the UI task"
  default     = 1024
}

variable "api_task_cpu" {
  type        = number
  description = "The CPU of the API task"
  default     = 512
}

variable "api_task_mem" {
  type        = number
  description = "The memory of the API task"
  default     = 1024
}

variable "r_task_cpu" {
  type        = number
  description = "The CPU of the R task"
  default     = 512
}

variable "r_task_mem" {
  type        = number
  description = "The memory of the R task"
  default     = 1024
}
