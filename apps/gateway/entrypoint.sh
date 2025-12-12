#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/prisma
bunx prisma migrate deploy --schema=./schema

echo "Starting gateway..."
cd /app
exec bun run start
