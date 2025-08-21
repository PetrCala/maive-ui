# ────────────────────────────────────────────────────────────────────────────────
# Lambda R Backend (Plumber) + AWS Lambda Web Adapter
# Multi-stage build on Amazon Linux 2023 to keep the final image lean.
# ────────────────────────────────────────────────────────────────────────────────

# ===== Stage 1: build R and compile R packages =====
FROM public.ecr.aws/docker/library/amazonlinux:2023 AS build

ARG R_VERSION=4.4.1
ENV R_VERSION=${R_VERSION}
ENV PATH="/usr/local/bin:${PATH}"

# System deps needed to build R and compile packages
RUN dnf -y update && dnf -y install \
    gcc gcc-c++ gcc-gfortran make \
    tar gzip wget which \
    perl perl-core perl-devel \
    zlib-devel bzip2 bzip2-devel xz xz-devel pcre2-devel \
    readline-devel libcurl-devel libxml2-devel openssl-devel \
    git \
 && dnf clean all

# Build & install R under /usr/local
RUN cd /tmp \
 && wget -q https://cran.r-project.org/src/base/R-4/R-${R_VERSION}.tar.gz \
 && tar -xzf R-${R_VERSION}.tar.gz \
 && cd R-${R_VERSION} \
 && ./configure --enable-R-shlib --with-readline --with-x=no --prefix=/usr/local \
 && make -j"$(nproc)" && make install \
 && cd / && rm -rf /tmp/R-${R_VERSION}* \
 && /usr/local/bin/R --version

# Copy your installers (do it early to leverage layer caching)
WORKDIR /build
COPY r_scripts/r-packages.txt /tmp/
COPY r_scripts/r-packages-extra.R /tmp/

# Optional GitHub PAT for private/ratelimit-safe installs (builder only)
ARG GITHUB_PAT
ARG GITHUB_USERNAME
RUN if [ -n "$GITHUB_PAT" ]; then \
      mkdir -p /usr/local/lib/R/etc && \
      echo "GITHUB_PAT=$GITHUB_PAT" >> /usr/local/lib/R/etc/Renviron.site && \
      echo "GITHUB_USERNAME=$GITHUB_USERNAME" >> /usr/local/lib/R/etc/Renviron.site; \
    fi

# Install CRAN packages
RUN R -q -e "pkgs <- readLines('/tmp/r-packages.txt'); install.packages(pkgs, repos='https://cran.rstudio.com/')"

# Install extra (e.g., GitHub) packages
RUN R -q -e "source('/tmp/r-packages-extra.R')" && rm -rf /tmp/*

# ===== Stage 2: final Lambda image (lean) =====
FROM public.ecr.aws/lambda/provided:al2023

# Adapter as an Extension (recommended for Docker images)
# https://github.com/awslabs/aws-lambda-web-adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# R runtime & libraries from the builder
COPY --from=build /usr/local /usr/local
ENV PATH="/usr/local/bin:${PATH}"

# Only runtime libs (no compilers) — keep it small
RUN dnf -y update && dnf -y install \
    # runtime-only dependencies commonly needed by R and compiled packages
    zlib bzip2-libs xz-libs pcre2 readline \
    libcurl libxml2 openssl-libs \
    libgcc libgfortran \
 && dnf clean all

# Web Adapter / server settings
ENV PORT=8787
ENV AWS_LWA_PORT=8787
ENV AWS_LWA_READINESS_CHECK_PROTOCOL=http
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_ENABLE_COMPRESSION=true
# (Enable response streaming only if you invoke via Function URL)
# ENV AWS_LWA_INVOKE_MODE=response_stream

# App code
WORKDIR ${LAMBDA_TASK_ROOT}
COPY r_scripts/index.R .
COPY r_scripts/maive_model.R .
COPY r_scripts/funnel_plot.R .

# Start the web server directly (required on AWS-managed base images)
# The adapter (as an extension) will perform readiness checks and proxy traffic.
ENTRYPOINT [ "R", "-q", "-e", "pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('PORT','8787')))" ]
