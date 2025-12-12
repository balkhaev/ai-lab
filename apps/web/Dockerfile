# Prune stage - create minimal workspace
FROM oven/bun:1.3.3-alpine AS pruner

RUN bun add -g turbo

WORKDIR /app
COPY . .
RUN turbo prune web --docker

# Dependencies stage
FROM oven/bun:1.3.3-alpine AS deps

WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies
RUN bun install --frozen-lockfile

# Builder stage - use node for Next.js build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy pruned source files FIRST
COPY --from=pruner /app/out/full/ .

# Copy node_modules AFTER (so it doesn't get overwritten)
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma client
WORKDIR /app/packages/db
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build arguments for environment variables
ARG NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL

WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built files (standalone preserves monorepo structure)
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["node", "apps/web/server.js"]
