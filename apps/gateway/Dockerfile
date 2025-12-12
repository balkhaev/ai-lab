# Prune stage - create minimal workspace
FROM oven/bun:1.3.3-alpine AS pruner

RUN bun add -g turbo

WORKDIR /app
COPY . .
RUN turbo prune gateway --docker

# Dependencies stage
FROM oven/bun:1.3.3-alpine AS deps

WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies
RUN bun install --frozen-lockfile

# Builder stage
FROM oven/bun:1.3.3-alpine AS builder

WORKDIR /app

# Copy pruned source files FIRST
COPY --from=pruner /app/out/full/ .

# Copy node_modules AFTER (so it doesn't get overwritten)
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma client (remove config to avoid prisma/config module issue)
WORKDIR /app/packages/db
RUN rm -f prisma.config.ts && \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate --schema=./prisma/schema

# Build
WORKDIR /app/apps/gateway
RUN bun run build

# Production stage
FROM oven/bun:1.3.3-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy built files
COPY --from=builder --chown=appuser:appgroup /app/apps/gateway/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/gateway/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "run", "start"]
