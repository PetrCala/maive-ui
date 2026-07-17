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

variable "ui_lambda_reserved_concurrency" {
  description = <<-EOT
    Reserved concurrency for the UI Lambda (-1 = unreserved). Caps how much the
    public UI Function URL can spend and stops a flood from consuming the
    account-wide concurrency pool that the R backend and orchestrator also draw
    from. UI requests are short (page loads and lightweight API routes), so a
    small cap is ample for minimal traffic; raise it if legitimate traffic grows
    (docs/COST_CONTROLS.md).
  EOT
  type        = number
  default     = 30
}

variable "lambda_r_backend_function_base_name" {
  type        = string
  description = "The base name of the Lambda function"
  default     = "lambda-r-backend"
}

variable "lambda_r_backend_memory_size" {
  type        = number
  description = "Memory size in MB for the Lambda R backend function"
  # 2048 MB ~= 1.15 vCPU. RTMA (phacking) sampling is single-threaded and
  # CPU-bound, so a faster single core matters more than extra cores.
  default = 2048
}

variable "lambda_r_backend_timeout" {
  type        = number
  description = "Timeout in seconds for the Lambda R backend function"
  default     = 600
}

variable "lambda_r_backend_reserved_concurrency" {
  description = <<-EOT
    Reserved concurrency for the Lambda R backend (-1 = unreserved). This is the
    primary cost/abuse control for the public /v1 API (docs/PUBLIC_API_DESIGN.md
    D2): it hard-caps concurrent R executions regardless of entry path (UI, sync
    /v1, or the async orchestrator), so worst-case spend is bounded and excess
    requests get a 429. Must stay above the orchestrator's maximum_concurrency
    (5) so async runs never starve synchronous UI/API calls.
  EOT
  type        = number
  default     = 10
}

variable "lambda_r_backend_log_retention_days" {
  type        = number
  description = "Number of days to retain Lambda R backend CloudWatch logs"
  default     = 3
}

variable "cost_circuit_breaker_enabled" {
  description = <<-EOT
    When true, sustained throttling of the R backend automatically trips the
    circuit breaker: an SNS-triggered Lambda sets the R backend's reserved
    concurrency to 0, halting all further compute spend until an operator
    restores it (docs/COST_CONTROLS.md). When false, the same condition only
    emails; no automatic shutoff happens.
  EOT
  type        = bool
  default     = true
}

variable "cost_circuit_breaker_throttle_periods" {
  description = <<-EOT
    Number of consecutive 5-minute periods of continuous R-backend throttling
    that must occur before the circuit breaker trips. Throttling only happens
    when demand exceeds the reserved-concurrency cap, so sustained throttling is
    a strong abuse signal; a multi-period window avoids tripping on brief
    organic bursts. Default 6 = ~30 minutes.
  EOT
  type        = number
  default     = 6
}
