#!/bin/sh

echo "=== Gateway Entrypoint ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'no')"

cd /app

# Run migrations only if RUN_MIGRATIONS=true
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    if ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema; then
        echo "Migrations completed successfully"
    else
        echo "WARNING: Migration failed (exit code: $?)"
        echo "Continuing startup anyway..."
    fi
else
    echo "Skipping migrations (set RUN_MIGRATIONS=true to enable)"
fi

echo "Starting gateway..."
exec bun run start
