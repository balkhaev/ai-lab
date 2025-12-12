# Build stage
FROM oven/bun:1.3.3-alpine AS builder

WORKDIR /app

# Copy all workspace package.json files for correct lockfile resolution
COPY package.json bun.lock* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/

# Generate Prisma client
WORKDIR /app/packages/db
RUN rm -f tsconfig.json && \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

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

# Copy Prisma schema, migrations and config for runtime migrations
COPY --from=builder --chown=appuser:appgroup /app/packages/db/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/packages/db/prisma.config.docker.ts ./prisma/prisma.config.ts

# Copy entrypoint script
COPY --chown=appuser:appgroup apps/gateway/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
