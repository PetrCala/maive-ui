# Start with a base image that has R pre-installed
# Source: https://github.com/rocker-org/ubuntu-lts
FROM rocker/r-ver:4

# Set up source package repositories
RUN echo 'options(repos = c(P3M = "https://packagemanager.posit.co/cran/__linux__/jammy/latest", CRAN = "https://cloud.r-project.org"))' >>"${R_HOME}/etc/Rprofile.site"

# Rewrite non-arm URL platforms into arm platforms
RUN /rocker_scripts/setup_R.sh 

# Set the working directory in the container to /r_scripts
WORKDIR /r_scripts

# Copy the R scripts directory into the container
COPY ./r_scripts /r_scripts

# Update the package list and install the R packages (prepend all with 'r-cran-')
RUN apt-get update && cat packages/r-packages.txt | sed 's/^/r-cran-/' | xargs apt-get install -y --no-install-recommends

# Install any non-standard packages
# RUN Rscript packages/r-packages-extra.R

# Make port 8787 available to the world outside this container
EXPOSE 8787

# Keep the container running
CMD ["R"]
