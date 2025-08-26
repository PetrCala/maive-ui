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
COPY --from=builder /app ./
COPY entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
