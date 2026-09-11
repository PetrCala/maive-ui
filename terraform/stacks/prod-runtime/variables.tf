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

variable "git_commit_hash" {
  type        = string
  description = "Full commit SHA the UI image was built from. Exposed to the UI Lambda as GIT_COMMIT_HASH so reproducibility packages link the exact source (#555). Empty means unknown; the app then links the default branch instead of a fake ref."
  default     = ""
}

variable "ui_lambda_memory_size" {
  type        = number
  description = "Memory size in MB for the UI Lambda function"
  default     = 1024
}

variable "ui_lambda_timeout" {
  type        = number
  description = <<-EOT
    Timeout in seconds for the UI Lambda function. Since #530 the UI Lambda
    proxies synchronous model runs to the IAM-protected R backend, so it must
    outlive the R backend's interactive request budget (120 s default plus
    grace, see request_bounds.R). Kept well below the R maximum (570 s) so an
    abusive caller cannot pin 1 GB UI instances for minutes; long runs belong
    on the async queue.
  EOT
  default     = 180
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
    from. UI requests are short (page loads and lightweight API routes), but a
    burst of visitors arriving together needs one instance per request for the
    ~1.2 s Next.js cold start. The old cap of 30 throttled in exactly those
    bursts (Jul 20, Aug 1, Aug 31 2026), which is what a room opening the site
    at a conference looks like. Reserved concurrency itself costs nothing
    (docs/COST_CONTROLS.md).
  EOT
  type        = number
  default     = 100
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
  # Measured in production at 2048 / 3538 / 5308 MB on the representative e2e
  # RTMA job (n = 40) and a large one (n = 300), three warm runs each, billed
  # duration and GB-s from the Lambda REPORT lines (#537):
  #
  #   n = 40:  2048 MB 6.4 s / 12.7 GB-s | 3538 MB 5.2 s / 17.8 GB-s
  #            | 5308 MB 4.2 s / 21.6 GB-s
  #   n = 300: 2048 MB 48.0 s / 95.9 GB-s | 3538 MB 26.2 s / 90.7 GB-s
  #            | 5308 MB 24.3 s / 126.0 GB-s
  #
  # 3538 stays the winner. On sampling-heavy jobs it is the cheapest in GB-s
  # and nearly as fast as 5308: a third vCPU cannot speed up 4 chains (waves
  # of 3 + 1 still make 2 waves) yet bills 1.5x the rate. 2048 is marginally
  # cheaper only on small jobs where fixed overhead dominates, and doubles the
  # wall time of large jobs, which is exactly the timeout exposure behind the
  # Aug 15 incident. Max memory used peaked at 1.3 GB, so no setting here is
  # memory-bound. Raising this only helps in steps of 1769 MB, and locals.tf
  # derives the core count from it, so a value between steps buys memory that
  # RTMA cannot use.
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
    requests get a 429. Must stay above var.orchestrator_maximum_concurrency
    (a precondition in orchestrator_lambda.tf enforces it) so async runs never
    starve synchronous UI/API calls: 25 = 15 async slots + 10 for sync callers.
  EOT
  type        = number
  default     = 25
}

variable "orchestrator_maximum_concurrency" {
  description = <<-EOT
    How many queued runs the SQS event source fans out to the orchestrator, and
    so to the R backend, at once. Every browser run goes through this queue, so
    it is the UI's analysis throughput limit. At 15, a burst of 40 simultaneous
    RTMA runs clears in about 80 s instead of about 4 minutes at 5. Must stay
    below var.lambda_r_backend_reserved_concurrency.
  EOT
  type        = number
  default     = 15

  validation {
    condition     = var.orchestrator_maximum_concurrency >= 2
    error_message = "SQS event source maximum_concurrency must be at least 2."
  }
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
    Daily Lambda compute budget in GB-seconds, summed across all functions.
    Crossing it publishes to the cost circuit breaker topic, which emails the
    operator and, when the breaker is enabled, trips the auto-shutoff
    (docs/COST_CONTROLS.md, #533). 60,000 GB-s is about $1 of compute at the
    x86 rate. It was 13,000 (a thirtieth of the 400,000 GB-s monthly free
    tier) until ordinary days reached 12,640 GB-s (Aug 24, Sep 5 2026), close
    enough that a conference demo would trip the breaker on legitimate load.
  EOT
  type        = number
  default     = 60000
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
