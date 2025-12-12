#!/bin/sh
set -e

echo "Running database migrations..."
cd /app

# Use prisma from node_modules directly
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema 2>&1 || {
    echo "Migration failed, but continuing startup..."
    echo "You may need to run migrations manually"
}

echo "Starting gateway..."
exec bun run start
