# ─────────────────────────────────────────────────────────
# APP IMAGE — tiny, reusing pre-baked R library base
# ─────────────────────────────────────────────────────────

ARG RLIB_IMAGE_URL

# 1) Start the private base
FROM ${RLIB_IMAGE_URL} AS base

# 2) Switch into a Lambda base (to get the Lambda runtime contract)
FROM public.ecr.aws/lambda/provided:al2023

# Bring in the pre-baked R from the base image
COPY --from=base /usr/local /usr/local
COPY --from=base /opt/rlib-manifest.txt /opt/rlib-manifest.txt
# Copy several libraries from the base image to the Lambda base image
COPY --from=base /usr/lib64/libgomp.so.1*      /usr/lib64/
COPY --from=base /usr/lib64/libgfortran.so.*   /usr/lib64/
COPY --from=base /usr/lib64/libquadmath.so.*   /usr/lib64/
COPY --from=base /usr/lib64/libsodium.so.*     /usr/lib64/
ENV PATH="/usr/local/bin:${PATH}"

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
# (Enable streaming ONLY with Function URL)
# ENV AWS_LWA_INVOKE_MODE=response_stream

# Check if the R library is complete
RUN sh -lc \
  "ldd /usr/local/lib64/R/bin/exec/R | grep 'not found' || true; \
   ldd /usr/local/lib64/R/lib/libR.so | grep 'not found' || true; \
   R -q -e 'sessionInfo()'"

# Start Plumber (adapter proxies requests)
ENTRYPOINT [ "R", "-q", "-e", "pr <- plumber::plumb('index.R'); pr$run(host='0.0.0.0', port=as.numeric(Sys.getenv('PORT','8787')))" ]
