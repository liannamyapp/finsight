#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "$SEED_DEMO" = "true" ]; then
  echo "Seeding demo data..."
  npx tsx prisma/seed.ts
fi

exec node dist/server.js
