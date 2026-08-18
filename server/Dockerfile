# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# Installs all dependencies (including devDependencies) and compiles TypeScript.
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
# Copies only the compiled output and production dependencies.
# No TypeScript compiler, no source files, no devDependencies.
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled JS from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
