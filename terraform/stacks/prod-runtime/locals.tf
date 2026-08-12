locals {
  ecr_urls = data.terraform_remote_state.foundation.outputs.ecr_repository_urls

  lambda_r_backend_function_name = "${var.project}-${var.lambda_r_backend_function_base_name}"

  lambda_r_backend_log_group_name = data.aws_cloudwatch_log_group.lambda_r_backend_logs.name

  # Lambda allocates ~1 vCPU per 1769 MB. RTMA forks its Stan chains, so the R
  # process has to be told how many cores it actually got: detecting them from
  # inside the sandbox reports the host, not the allocation. Deriving the count
  # from memory_size here is what keeps the two from drifting apart when the
  # memory size is next tuned (#483).
  lambda_r_backend_vcpus = max(1, floor(var.lambda_r_backend_memory_size / 1769))
}

