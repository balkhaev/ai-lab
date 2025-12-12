#!/bin/sh

echo "=== Gateway Entrypoint ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'no')"

cd /app

# Run migrations only if RUN_MIGRATIONS=true
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    cd /app/prisma
    MIGRATION_OUTPUT=$(../node_modules/.bin/prisma migrate deploy 2>&1)
    MIGRATION_EXIT=$?
    echo "$MIGRATION_OUTPUT"
    cd /app
    if [ $MIGRATION_EXIT -eq 0 ]; then
        echo "Migrations completed successfully"
    else
        echo "WARNING: Migration failed (exit code: $MIGRATION_EXIT)"
        echo "Continuing startup anyway..."
    fi
else
    echo "Skipping migrations (set RUN_MIGRATIONS=true to enable)"
fi

echo "Starting gateway..."
exec bun run start
