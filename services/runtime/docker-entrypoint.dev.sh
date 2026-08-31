#!/bin/sh
set -e
cd /app
npx prisma generate --schema=services/platform/prisma/schema.prisma
MONGODB_URL="${MONGODB_URL:-mongodb://localhost:27017/namao}" \
  npx prisma generate --schema=services/runtime/prisma/schema.prisma
exec npm run start:dev -w @namao/runtime
