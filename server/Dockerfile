# Asta API (NestJS) — multi-stage production image
FROM node:20-alpine AS build
WORKDIR /app
# Install with the repo's single hoisted tree (npm workspaces)
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci
COPY server ./server
RUN npm run build --workspace server

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
EXPOSE 3000
# Run from the server dir so ConfigModule resolves .env / env vars correctly.
WORKDIR /app/server
CMD ["node", "dist/main.js"]
