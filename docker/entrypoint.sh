#!/bin/sh
# Server entrypoint: run Drizzle migrations then start the Hono server.
# Using exec so Node.js receives OS signals (SIGTERM) for graceful shutdown.
set -e

# npm scripts inject npm_package_version automatically; plain `node` does not.
# /api/health reports it, so derive it from package.json here.
export npm_package_version="$(node -p "require('./package.json').version")"

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting server..."
exec node dist/index.js
