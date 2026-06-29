# Asta web (Angular) — build then serve static via nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci
COPY client ./client
RUN npm run build --workspace client

FROM nginx:1.27-alpine AS runner
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist/client/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
