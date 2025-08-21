# Lambda R Backend Dockerfile
FROM public.ecr.aws/lambda/provided:al2

# --- Versions & ports ---
ENV R_VERSION=4.4.1
# Lambda Web Adapter defaults to port 8080; we'll explicitly use 8787 for Plumber
ENV PORT=8787
ENV AWS_LWA_PORT=8787
# Use TCP readiness so we don't depend on a specific HTTP path existing
ENV AWS_LWA_READINESS_CHECK_PROTOCOL=tcp

# --- Add the Lambda Web Adapter (as an Extension) ---
# Per repo: copy the /lambda-adapter binary to /opt/extensions
# (Works with any base image; for AWS-managed base images we override ENTRYPOINT below)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter


# --- GitHub PAT for MAIVE package installation ---
ARG GITHUB_PAT
ARG GITHUB_USERNAME
RUN if [ -n "$GITHUB_PAT" ]; then \
      mkdir -p /usr/local/lib/R/etc && \
      echo "GITHUB_PAT=$GITHUB_PAT" >> /usr/local/lib/R/etc/Renviron.site && \
      echo "GITHUB_USERNAME=$GITHUB_USERNAME" >> /usr/local/lib/R/etc/Renviron.site; \
    fi

# Set the working directory to Lambda task root where the handler runs
WORKDIR ${LAMBDA_TASK_ROOT}

# --- System deps to build R and R packages ---
RUN yum -y update && yum -y install \
      gcc gcc-c++ gcc-gfortran make \
      tar gzip wget which \
      perl perl-core perl-devel \
      zlib-devel bzip2 bzip2-devel xz-devel pcre2-devel \
      readline-devel libcurl-devel libxml2-devel openssl-devel \
      git \
  && yum clean all && rm -rf /var/cache/yum

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

# Copy package installation scripts
COPY r_scripts/r-packages.txt /tmp/
COPY r_scripts/r-packages-extra.R /tmp/

# Install R packages from CRAN
RUN R -q -e "packages <- readLines('/tmp/r-packages.txt'); install.packages(packages, repos='https://cran.rstudio.com/')"

# Install any non-standard packages
RUN R -q -e "source('/tmp/r-packages-extra.R')"

# Clean up temporary files and build dependencies
RUN rm -rf /tmp/r-packages.txt \
    && rm -rf /tmp/r-packages-extra.R \
    && yum remove -y gcc gcc-c++ make git \
    && yum clean all \
    && rm -rf /var/cache/yum \
    && rm -rf /tmp/*

COPY r_scripts/index.R .
COPY r_scripts/maive_model.R .
COPY r_scripts/funnel_plot.R .

CMD ["R","-q","-e","pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('PORT', '8787')))"]