# Install packages from CRAN
packages <- c()
maive_packages <- c(
  "clubSandwich",
  "varhandle",
  "pracma",
  "sandwich"
)
install.packages(c(packages, maive_packages), dependencies = TRUE)

check_github_auth <- function() {
  pat <- Sys.getenv("GITHUB_PAT")

  if (nchar(pat) > 0) {
    cli::cli_alert_success("GitHub authentication available")
    TRUE
  } else {
    cli::cli_alert_warning("No GitHub Personal Access Token found. Rate limits may apply.")
    FALSE
  }
}

# Install the MAIVE package - runs from the 'apps/r-plumber' directory
install_forked <- TRUE # Whether to install from the forked repository
maive_repo_name <- "maive"

if (install_forked) {
  cli::cli_alert_info("Installing MAIVE from the forked repository")
  forked_owner <- "PetrCala"
  forked_tag_name <- "ui-v0.1.0-qfi" # quadratic-fit-info

  # Check authentication before attempting installation
  if (check_github_auth()) {
    tryCatch(
      {
        remotes::install_github(
          paste0(forked_owner, "/", maive_repo_name),
          ref = forked_tag_name,
          auth_token = Sys.getenv("GITHUB_PAT")
        )
        cli::cli_alert_success("MAIVE package installed successfully")
      },
      error = function(e) {
        cli::cli_alert_danger("Failed to install MAIVE package: {e$message}")
        if (grepl("rate limit", tolower(e$message))) {
          cli::cli_alert_info("Rate limit exceeded. Consider:")
          cli::cli_alert_info("1. Using a GitHub Personal Access Token")
          cli::cli_alert_info("2. Waiting for rate limit reset")
          cli::cli_alert_info("3. Building during off-peak hours")
        }
        cli::cli_abort("Package installation failed")
      }
    )
  } else {
    # Try without authentication (may hit rate limits)
    tryCatch(
      {
        remotes::install_github(
          paste0(forked_owner, "/", maive_repo_name),
          ref = forked_tag_name,
          auth_token = Sys.getenv("GITHUB_PAT")
        )
        cli::cli_alert_success("MAIVE package installed successfully")
      },
      error = function(e) {
        cli::cli_alert_danger("Failed to install MAIVE package: {e$message}")
        if (grepl("rate limit", tolower(e$message))) {
          cli::cli_alert_danger("Rate limit exceeded. Please provide GITHUB_PAT environment variable.")
          cli::cli_alert_info("To fix this:")
          cli::cli_alert_info("1. Create a GitHub Personal Access Token")
          cli::cli_alert_info("2. Set GITHUB_PAT environment variable")
          cli::cli_alert_info("3. Rebuild the Docker image")
        }
        cli::cli_abort("Package installation failed")
      }
    )
  }
} else {
  cli::cli_alert_info("Installing MAIVE from the original GitHub repository")
  original_owner <- "meta-analysis-es"
  original_tag_name <- "v0.1.0"

  if (check_github_auth()) {
    tryCatch(
      {
        remotes::install_github(
          paste0(original_owner, "/", maive_repo_name),
          ref = original_tag_name,
          auth_token = Sys.getenv("GITHUB_PAT")
        )
        cli::cli_alert_success("MAIVE package installed successfully")
      },
      error = function(e) {
        cli::cli_alert_danger("Failed to install MAIVE package: {e$message}")
        cli::cli_abort("Package installation failed")
      }
    )
  } else {
    tryCatch(
      {
        remotes::install_github(
          paste0(original_owner, "/", maive_repo_name),
          ref = original_tag_name,
          auth_token = Sys.getenv("GITHUB_PAT")
        )
        cli::cli_alert_success("MAIVE package installed successfully")
      },
      error = function(e) {
        cli::cli_alert_danger("Failed to install MAIVE package: {e$message}")
        cli::cli_abort("Package installation failed")
      }
    )
  }
}
