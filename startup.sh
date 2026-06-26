#!/bin/sh
set -e

# Add connection_limit=1 to DATABASE_URL for Neon free tier.
# Each Cloud Run instance uses at most 1 DB connection.
if echo "$DATABASE_URL" | grep -qF '?'; then
  export DATABASE_URL="${DATABASE_URL}&connection_limit=1&pool_timeout=15"
else
  export DATABASE_URL="${DATABASE_URL}?connection_limit=1&pool_timeout=15"
fi

echo "[startup] Starting server (migrations run inside NestJS onModuleInit)..."
exec node dist/main.js
