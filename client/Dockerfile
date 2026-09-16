# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# Installs dependencies, runs TypeScript compilation, and builds production Vite assets.
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production Nginx runtime ──────────────────────────────────────────
# Uses lightweight Nginx alpine to serve static assets with SPA routing.
FROM nginx:alpine AS production

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

