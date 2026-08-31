#!/bin/sh
set -e
cd /app
npx prisma migrate deploy --schema=services/platform/prisma/schema.prisma
npx prisma generate --schema=services/platform/prisma/schema.prisma
npm run build -w @namao/landing-kit
exec npx concurrently -n kit,api -c cyan,blue \
  "npm run watch -w @namao/landing-kit" \
  "npm run start:dev -w @namao/platform"
