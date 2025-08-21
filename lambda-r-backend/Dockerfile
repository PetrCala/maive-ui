# ─────────────────────────────────────────────────────────
# APP IMAGE — tiny, reusing pre-baked R library base
# ─────────────────────────────────────────────────────────

# We want to fail early if RLIB_IMAGE_URL is missing
ARG RLIB_IMAGE_URL

# Assert stage to validate the ARG
FROM public.ecr.aws/docker/library/amazonlinux:2023 AS assert
ARG RLIB_IMAGE_URL
RUN test -n "$RLIB_IMAGE_URL" || (echo >&2 "RLIB_IMAGE_URL is required. Pass --build-arg RLIB_IMAGE_URL=..."; exit 1)

# 1) Pull your pre-baked R base
FROM ${RLIB_IMAGE_URL} AS base

# 2) Switch into a Lambda base (contracts + entrypoints)
FROM public.ecr.aws/lambda/provided:al2023

# ── Runtime libraries needed by R and compiled packages ──
# Do NOT install openssl-libs (conflicts with snapsafe). Add libquadmath only on x86_64.
RUN dnf -y update && dnf -y install \
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
 && if [ "$(uname -m)" = "x86_64" ]; then dnf -y install libquadmath; fi \
 && dnf clean all

# Make R's own libs discoverable without ldconfig
# (cover both lib64 and lib layouts, depending on how R resolved R_HOME)
ENV LD_LIBRARY_PATH="/usr/local/lib64/R/lib:/usr/local/lib64:/usr/local/lib/R/lib:/usr/local/lib:${LD_LIBRARY_PATH}"

# Bring in pre-baked R and packages
COPY --from=base /usr/local /usr/local
COPY --from=base /opt/rlib-manifest.txt /opt/rlib-manifest.txt
ENV PATH="/usr/local/bin:${PATH}"

# Self-heal if R resolves RHOME to the other lib layout (lib vs lib64)
RUN bash -lc '\
  set -e; RH="$(R RHOME)"; echo "RHOME=$RH"; \
  if [ ! -d "$RH/library" ]; then \
    if [ -d /usr/local/lib64/R ] && [ ! -e /usr/local/lib/R ]; then \
      mkdir -p /usr/local/lib && ln -s /usr/local/lib64/R /usr/local/lib/R; \
    elif [ -d /usr/local/lib/R ] && [ ! -e /usr/local/lib64/R ]; then \
      mkdir -p /usr/local/lib64 && ln -s /usr/local/lib/R /usr/local/lib64/R; \
    fi; \
  fi'

# Lightweight sanity prints (do not rely on utils/stats)
RUN R -q -e "cat('RHOME=', R.home(), '\n'); cat('RLIB=', R.home('library'), '\n'); cat('R=', getRversion(), '\n'); cat('.libPaths=', paste(.libPaths(), collapse='|'), '\n')"

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
# Enable streaming only when using Function URLs
# ENV AWS_LWA_INVOKE_MODE=response_stream

# Start Plumber (adapter proxies requests)
ENTRYPOINT [ "R", "-q", "-e", "pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('PORT','8787')))" ]
