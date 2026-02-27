FROM node:24-alpine3.22 AS builder

ARG SERVICE_DIR

WORKDIR /app

COPY ${SERVICE_DIR}/package*.json ./
RUN npm ci && npm cache clean --force

COPY ${SERVICE_DIR}/ ./
RUN npm run build

FROM node:24-alpine3.22 AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/main.js"]
