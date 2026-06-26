#!/bin/sh
set -e

# Add connection_limit=1 to DATABASE_URL for Neon free tier.
# Each Cloud Run instance gets at most 1 DB connection, preventing exhaustion.
if echo "$DATABASE_URL" | grep -qF '?'; then
  export DATABASE_URL="${DATABASE_URL}&connection_limit=1&pool_timeout=10"
else
  export DATABASE_URL="${DATABASE_URL}?connection_limit=1&pool_timeout=10"
fi

echo "[startup] Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[startup] Starting server..."
exec node dist/main.js
