#!/bin/sh
set -e

mkdir -p /app/storage/public /app/storage/private
/opt/prisma/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma
exec "$@"
