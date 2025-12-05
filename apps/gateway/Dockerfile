FROM oven/bun:1.3.3-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/config/package.json ./packages/config/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY apps/gateway/package.json ./apps/gateway/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/

# Build
WORKDIR /app/apps/gateway
RUN bun run build

# Production image
FROM oven/bun:1.3.3-alpine

WORKDIR /app

COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]

