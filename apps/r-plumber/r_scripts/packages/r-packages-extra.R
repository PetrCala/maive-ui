# Install packages from CRAN
packages <- c()
maive_packages <- c(
  "varhandle",
  "pracma",
  "sandwich"
)
install.packages(c(packages, maive_packages), dependencies = TRUE)

# Install the MAIVE package
maive_repo_name <- "meta-analysis-es/maive"
maive_tag_name <- "v0.1.0"
devtools::install_github(repo = maive_repo_name, ref = maive_tag_name)
