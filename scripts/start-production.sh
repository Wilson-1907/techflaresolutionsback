#!/bin/sh
set -e

PORT="${PORT:-4000}"

# Prisma CLI via node â€” works in Docker standalone (no npm bin on PATH)
node ./node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate

if [ -f "./server.js" ]; then
  exec node server.js
fi

exec npx next start -H 0.0.0.0 -p "$PORT"
