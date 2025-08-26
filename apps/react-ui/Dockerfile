# Stage 1: Build
FROM node:21-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production

# Install npm with retry logic and configure npm
RUN apk add --no-cache curl && \
    npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

COPY client/package*.json ./

# Use npm ci with retry logic and better error handling
RUN npm ci --omit=dev --prefer-offline --no-audit || \
    (sleep 10 && npm ci --omit=dev --prefer-offline --no-audit) || \
    (sleep 30 && npm ci --omit=dev --prefer-offline --no-audit)

COPY client/ ./
RUN npm run build

# Stage 2: Run
FROM node:21-alpine
WORKDIR /app
COPY --from=builder /app ./
COPY entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
