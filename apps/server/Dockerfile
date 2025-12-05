FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/config/package.json ./packages/config/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# Build
WORKDIR /app/apps/server
RUN bun run build

# Production image
FROM oven/bun:1.1-alpine

WORKDIR /app

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]

