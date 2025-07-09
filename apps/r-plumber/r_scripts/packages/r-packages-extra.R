# Install packages from CRAN
# packages <- c("") # Add packages here
# install.packages(packages, dependencies = TRUE)

# Install the MAIVE package
maive_repo_name <- "meta-analysis-es/maive"
maive_tag_name <- "v0.1.0"
devtools::install_github(repo = maive_repo_name, ref = maive_tag_name)
