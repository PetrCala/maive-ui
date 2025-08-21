# Lambda R Backend Dockerfile
FROM public.ecr.aws/lambda/provided:al2

# Accept GitHub Personal Access Token as build argument
ARG GITHUB_PAT
ARG GITHUB_USERNAME

# Configure GitHub authentication if token is provided
RUN if [ -n "$GITHUB_PAT" ]; then \
      echo "GITHUB_PAT=$GITHUB_PAT" >> /usr/local/lib/R/etc/Renviron.site && \
      echo "GITHUB_USERNAME=$GITHUB_USERNAME" >> /usr/local/lib/R/etc/Renviron.site; \
    fi

# Set the working directory to Lambda task root where the handler runs
WORKDIR ${LAMBDA_TASK_ROOT}

# Install system dependencies
RUN yum update -y && \
    yum install -y \
    R \
    R-devel \
    gcc \
    gcc-c++ \
    make \
    libpng-devel \
    libjpeg-devel \
    libtiff-devel \
    cairo-devel \
    pango-devel \
    libcurl-devel \
    openssl-devel \
    libxml2-devel \
    git \
    && yum clean all \
    && rm -rf /var/cache/yum

# Set R environment variables
ENV R_HOME=/usr/lib64/R
ENV PATH=$PATH:$R_HOME/bin

# Copy package installation scripts
COPY r_scripts/r-packages.txt /tmp/
COPY r_scripts/r-packages-extra.R /tmp/

# Set up source package repositories
# RUN echo 'options(repos = c(P3M = "https://packagemanager.posit.co/cran/__linux__/jammy/latest", CRAN = "https://cloud.r-project.org"))' >>"${R_HOME}/etc/Rprofile.site"

# Install R packages from CRAN
RUN Rscript -e "packages <- readLines('/tmp/r-packages.txt'); install.packages(packages, repos='https://cran.rstudio.com/')"

# Copy vendor folder for custom MAIVE package
COPY vendor/ /tmp/vendor/

# Install custom MAIVE package from vendor folder
RUN if [ -d "/tmp/vendor/maive" ]; then \
        echo "Installing MAIVE package from vendor folder"; \
        R CMD INSTALL /tmp/vendor/maive; \
    else \
        echo "Vendor folder not found, will install from GitHub"; \
    fi

# Install additional packages and MAIVE from GitHub if vendor not available
RUN Rscript -e "source('/tmp/r-packages-extra.R')"

# Clean up temporary files and build dependencies
RUN rm -rf /tmp/r-packages.txt \
    && rm -rf /tmp/r-packages-extra.R \
    && rm -rf /tmp/vendor \
    && yum remove -y gcc gcc-c++ make git \
    && yum clean all \
    && rm -rf /var/cache/yum \
    && rm -rf /tmp/*

COPY r_scripts/index.R .
COPY r_scripts/maive_model.R .
COPY r_scripts/funnel_plot.R .

# Set the handler
CMD ["index.handler"]
