FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=@taxi/shared --workspace=@taxi/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=@taxi/shared && npm run build --workspace=@taxi/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=@taxi/shared --workspace=@taxi/api --include-workspace-root --omit=dev
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/taxi.db
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
