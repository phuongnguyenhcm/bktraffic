FROM node:26.13.1-bookworm-slim AS base
WORKDIR /app

FROM base AS backend-build
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src/ ./src/
RUN npm run build

FROM base AS frontend-build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig*.json frontend/.env.production ./
COPY frontend/public/ ./public/
COPY frontend/src/ ./src/
RUN npm run build

FROM base AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=backend-build /app/dist/ ./dist/
COPY --from=frontend-build /app/dist/ /app/frontend/dist/
COPY --chown=node:node backend/data/ ./data/
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
