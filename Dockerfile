FROM node:24-alpine3.22 AS builder

ARG SERVICE_DIR
WORKDIR /app

COPY ${SERVICE_DIR}/package*.json ./
RUN npm ci

COPY ${SERVICE_DIR}/ ./
RUN npm run build

FROM node:24-alpine3.22 AS deps

ARG SERVICE_DIR
WORKDIR /app

COPY ${SERVICE_DIR}/package*.json ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["dist/main.js"]