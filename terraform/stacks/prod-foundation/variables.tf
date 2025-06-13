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

variable "services" {
  type    = list(string)
  default = ["react-ui", "r-plumber"]
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "github_repo" {
  type    = string
  default = "PetrCala/maive-ui"
}

variable "release_branch" {
  type    = string
  default = "release"
}
