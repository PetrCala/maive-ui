variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "project" {
  type    = string
  default = "maive"
}

variable "services" {
  type    = list(string)
  default = ["react-ui", "flask-api", "r-plumber"]
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
