# Install packages from CRAN
packages <- c()
maive_packages <- c(
  "varhandle",
  "pracma",
  "sandwich"
)
install.packages(c(packages, maive_packages), dependencies = TRUE)

# Install the MAIVE package - runs from the 'apps/r-plumber' directory
install_local <- TRUE
maive_tag_name <- "v0.1.0"

if (install_local) {
  cli::cli_alert_info("Installing MAIVE from local directory")
  devtools::install_local(path = "vendor/maive")
} else {
  maive_repo_name <- "meta-analysis-es/maive"
  cli::cli_alert_info("Installing MAIVE from GitHub")
  devtools::install_github(repo = maive_repo_name, ref = maive_tag_name)
}
