# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NODE_ENV=production

COPY client/package.json ./
COPY client/bun.lock ./

# Use bun install with frozen lockfile
RUN bun install --frozen-lockfile || \
    (sleep 10 && bun install --frozen-lockfile) || \
    (sleep 30 && bun install --frozen-lockfile)

COPY client/ ./
RUN bun run build

# Stage 2: Run
FROM oven/bun:1
WORKDIR /app

# AWS Lambda Web Adapter: when running on Lambda it bridges Function URL events
# to the local HTTP server. Inert outside the Lambda runtime, so the same image
# still runs as a normal container locally and on ECS (dual-mode).
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health

COPY --from=builder /app ./
COPY entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
