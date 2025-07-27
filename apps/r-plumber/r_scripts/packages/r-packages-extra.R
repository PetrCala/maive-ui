# Install packages from CRAN
packages <- c()
maive_packages <- c(
  "clubSandwich",
  "varhandle",
  "pracma",
  "sandwich"
)
install.packages(c(packages, maive_packages), dependencies = TRUE)

# Install the MAIVE package - runs from the 'apps/r-plumber' directory
install_forked <- TRUE # Whether to install from the forked repository
maive_repo_name <- "maive"

if (install_forked) {
  cli::cli_alert_info("Installing MAIVE from the forked repository")
  forked_owner <- "PetrCala"
  forked_tag_name <- "ui-v0.1.0-qfi" # quadratic-fit-info
  devtools::install_github(repo = paste0(forked_owner, "/", maive_repo_name), ref = forked_tag_name)
} else {
  cli::cli_alert_info("Installing MAIVE from the original GitHub repository")
  original_owner <- "meta-analysis-es"
  original_tag_name <- "v0.1.0"
  devtools::install_github(repo = paste0(original_owner, "/", maive_repo_name), ref = original_tag_name)
}
