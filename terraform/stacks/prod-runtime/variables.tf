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
  default     = 30
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
  # 3538 MB = 2 x 1769, so exactly 2 vCPUs. RTMA's Stan sampling is ~95% of its
  # wall time and rstan forks its 4 chains across whatever mc.cores says, so a
  # second core roughly halves it (#483). The old 2048 MB was ~1.15 vCPU, which
  # cannot overlap chains at all whatever mc.cores is set to.
  #
  # This is not a straight cost increase: a run that takes half as long at 1.73x
  # the memory rate is cheaper in GB-s than it was. Raising this further only
  # helps in steps of 1769 MB, and locals.tf derives the core count from it, so
  # a value between steps buys memory that RTMA cannot use.
  default = 3538
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
  default     = 30
}

variable "cost_circuit_breaker_enabled" {
  description = <<-EOT
    When true, sustained throttling of the R backend automatically trips the
    circuit breaker: an SNS-triggered Lambda degrades the R backend's reserved
    concurrency to var.cost_circuit_breaker_degraded_concurrency and enables
    the unstable banner, bounding compute spend until an operator restores the
    cap (docs/COST_CONTROLS.md). When false, the same condition only emails;
    no automatic degradation happens.
  EOT
  type        = bool
  default     = true
}

variable "cost_circuit_breaker_degraded_concurrency" {
  description = <<-EOT
    Reserved concurrency the circuit breaker sets on the R backend when it
    trips. Degrade, don't kill: the value must be at least 1 so the service
    stays usable at a bounded spend rate while an operator investigates.
  EOT
  type        = number
  default     = 2

  validation {
    condition     = var.cost_circuit_breaker_degraded_concurrency >= 1
    error_message = "Must be at least 1; 0 would kill the backend instead of degrading it."
  }
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

variable "lambda_daily_gb_seconds_budget" {
  description = <<-EOT
    Daily Lambda compute budget in GB-seconds, summed across all functions. The
    AWS free tier grants 400,000 GB-s per month, so the default is roughly one
    thirtieth of that. Crossing it publishes to the cost circuit breaker topic,
    which emails the operator and, when the breaker is enabled, trips the
    auto-shutoff (docs/COST_CONTROLS.md, #533).
  EOT
  type        = number
  default     = 13000
}

variable "lambda_r_backend_hourly_error_threshold" {
  description = <<-EOT
    Number of R backend errors per hour above which the error-storm alarm
    publishes to the cost circuit breaker topic (#534). The Aug 15 incident
    produced 67 timeout errors over a day with nothing watching them; a healthy
    hour has zero, so anything past a handful is a storm, not noise.
  EOT
  type        = number
  default     = 5
}
