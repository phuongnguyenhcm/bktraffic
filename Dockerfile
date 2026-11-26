FROM node:26.13.1-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ ./dist/
# Nếu bạn có copy sẵn thư mục build FE vào ./public hoặc ./frontend/dist thì bỏ comment dòng dưới:
# COPY frontend/dist/ ./frontend/dist/

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]