# Lambda R Backend Dockerfile
FROM public.ecr.aws/lambda/provided:al2

ENV R_VERSION=4.4.1
ENV R_PORT=8787

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

# --- System deps needed to build R ---
RUN yum -y update && yum -y install \
  gcc gcc-c++ gcc-gfortran make \
  tar gzip wget which \
  perl perl-core perl-devel \
  zlib-devel bzip2 bzip2-devel xz-devel pcre2-devel \
  readline-devel libcurl-devel libxml2-devel openssl-devel && \
  yum clean all && rm -rf /var/cache/yum

# --- Build & install R ---
RUN cd /tmp && \
  wget -q https://cran.r-project.org/src/base/R-4/R-${R_VERSION}.tar.gz && \
  tar -xzf R-${R_VERSION}.tar.gz && \
  cd R-${R_VERSION} && \
  ./configure --enable-R-shlib --with-readline --with-x=no --prefix=/usr/local && \
  make -j"$(nproc)" && make install && \
  cd / && rm -rf /tmp/R-${R_VERSION}* && \
  /usr/local/bin/R --version

# Make sure R is on PATH
ENV PATH="/usr/local/bin:${PATH}"

# # Set R environment variables
# ENV R_HOME=/usr/lib64/R
# ENV PATH=$PATH:$R_HOME/bin

# --- Lambda Web Adapter (lets Lambda call your HTTP server) ---
ADD https://github.com/awslabs/aws-lambda-web-adapter/releases/latest/download/aws-lambda-adapter /opt/aws-lambda-adapter
RUN chmod +x /opt/aws-lambda-adapter
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/aws-lambda-adapter

# Copy package installation scripts
COPY r_scripts/r-packages.txt /tmp/
COPY r_scripts/r-packages-extra.R /tmp/

# Set up source package repositories
# RUN echo 'options(repos = c(P3M = "https://packagemanager.posit.co/cran/__linux__/jammy/latest", CRAN = "https://cloud.r-project.org"))' >>"${R_HOME}/etc/Rprofile.site"

# Install R packages from CRAN
RUN R -e "packages <- readLines('/tmp/r-packages.txt'); install.packages(packages, repos='https://cran.rstudio.com/')"

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
RUN R -e "source('/tmp/r-packages-extra.R')"

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

# Start Plumber; the Web Adapter will bridge Lambda events to HTTP
CMD ["R","-q","-e","pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('R_PORT', ${R_PORT})))"]

# Set the handler
CMD ["index.handler"]
