# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/ shared/
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ src/
COPY public/ public/
RUN npm run build

# Stage 2: Compile server native dependencies (better-sqlite3)
FROM node:22-alpine AS server-deps
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app/server
COPY server/package.json package.json
COPY --from=server-deps /app/server/node_modules node_modules
COPY --from=frontend-builder /app/dist ../dist/
COPY server/src/ src/
COPY shared/ ../shared/
RUN mkdir -p data
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
