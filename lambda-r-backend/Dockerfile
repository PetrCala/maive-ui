# ─────────────────────────────────────────────────────────
# APP IMAGE — tiny, reusing pre-baked R library base
# ─────────────────────────────────────────────────────────

ARG PROJECT_NAME
ARG AWS_ACCOUNT_ID
ARG AWS_REGION
ARG R_VERSION
ARG RLIB_IMAGE_HASH

# 1) Pull your pre-baked R base
FROM ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-rlib:al2023-r${R_VERSION}-${RLIB_IMAGE_HASH} AS base

# 2) Switch into a Lambda base (contracts + entrypoints)
FROM public.ecr.aws/lambda/provided:al2023

# ── Runtime libraries needed by R and compiled packages ──
# Do NOT install openssl-libs (conflicts with snapsafe). Add libquadmath only on x86_64.
RUN dnf -y update && dnf -y install \
    libicu \
    libgomp \
    libgfortran \
    libstdc++ \
    libsodium \
    libxml2 \
    zlib \
    bzip2-libs \
    xz-libs \
    pcre2 \
    readline \
    which \
    findutils \
    tar \
    gzip \
    bzip2 \
    xz \
    unzip \
    zip \
    glibc-langpack-en \
    # For plotting
    freetype harfbuzz fribidi fontconfig libpng libjpeg-turbo libtiff \
 && if [ "$(uname -m)" = "x86_64" ]; then dnf -y install libquadmath; fi \
 && dnf clean all

ENV LC_ALL=C.UTF-8 LANG=C.UTF-8
# Make R's own libs discoverable without ldconfig
# (cover both lib64 and lib layouts, depending on how R resolved R_HOME)
ENV LD_LIBRARY_PATH="/usr/local/lib64/R/lib:/usr/local/lib64:/usr/local/lib/R/lib:/usr/local/lib:${LD_LIBRARY_PATH}"

# Bring in pre-baked R and packages
COPY --from=base /usr/local /usr/local
COPY --from=base /opt/rlib-manifest.txt /opt/rlib-manifest.txt
ENV PATH="/usr/local/bin:${PATH}"

# Self-heal if R resolves RHOME to the other lib layout (lib vs lib64)
RUN bash -lc '\
  RH="$(R RHOME)"; \
  if [ ! -d "$RH/library" ]; then \
    if [ -d /usr/local/lib64/R ] && [ ! -e /usr/local/lib/R ]; then \
      mkdir -p /usr/local/lib && ln -s /usr/local/lib64/R /usr/local/lib/R; \
    elif [ -d /usr/local/lib/R ] && [ ! -e /usr/local/lib64/R ]; then \
      mkdir -p /usr/local/lib64 && ln -s /usr/local/lib/R /usr/local/lib64/R; \
    fi; \
  fi'

# ensure lib vs lib64 layout is bridged
RUN bash -lc 'RH="$(R RHOME)"; [ -d "$RH/library" ] || { \
  [ -d /usr/local/lib64/R ] && [ ! -e /usr/local/lib/R ] && mkdir -p /usr/local/lib && ln -s /usr/local/lib64/R /usr/local/lib/R || true; \
  [ -d /usr/local/lib/R ]   && [ ! -e /usr/local/lib64/R ] && mkdir -p /usr/local/lib64 && ln -s /usr/local/lib/R /usr/local/lib64/R || true; \
}'

# Sanity checks
RUN R -q --vanilla -e "base::library(utils); base::library(stats); cat('utils+stats loaded OK\n')"
RUN /usr/bin/which which || true; command -v which || true
RUN R -q --vanilla -e "print(Sys.which(c('tar','gzip','bzip2','xz','zip','unzip')))"

# Lightweight sanity prints
RUN R -q --vanilla -e " \
  cat('RHOME=', R.home(), '\n'); \
  cat('RLIB=', R.home('library'), '\n'); \
  cat('R=', R.version.string, '\n'); \
  cat('.libPaths=', paste(.libPaths(), collapse='|'), '\n'); \
  cat('have utils? ', dir.exists(file.path(R.home('library'),'utils')), '\n'); \
  cat('have stats? ', dir.exists(file.path(R.home('library'),'stats')), '\n') \
"

# Lambda Web Adapter (extension)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# App code
WORKDIR ${LAMBDA_TASK_ROOT}
COPY r_scripts/index.R .
COPY r_scripts/maive_model.R .
COPY r_scripts/funnel_plot.R .

# Adapter / server settings
ENV PORT=8787
ENV AWS_LWA_PORT=8787
ENV AWS_LWA_READINESS_CHECK_PROTOCOL=http
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_LOG_LEVEL=debug
# Enable streaming only when using Function URLs
# ENV AWS_LWA_INVOKE_MODE=response_stream

# Parses index.R and builds the router; doesn’t start the server
RUN R -q --vanilla -e "pr <- plumber::plumb('index.R'); cat('routes:', length(pr$endpoints), '\n')"

# Start Plumber (adapter proxies requests)
ENTRYPOINT [ "R", "-q", "-e", "pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('PORT','8787')))" ]
