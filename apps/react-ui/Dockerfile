# Stage 1: Build
FROM node:21-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY client/package*.json ./
RUN npm ci --omit=dev
RUN npm install --save-dev eslint
COPY client/ ./
RUN npm run build

# Stage 2: Run
FROM node:21-alpine
WORKDIR /app
COPY --from=builder /app ./
COPY entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
