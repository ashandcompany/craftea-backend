FROM node:24-alpine3.22 AS builder

ARG SERVICE_DIR
WORKDIR /app

COPY ${SERVICE_DIR}/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY ${SERVICE_DIR}/ ./
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["dist/main.js"]