# Imagem de produção da API (Coolify / GHCR). Desenvolvimento local: `npm run dev:local`.
FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY services/platform/package.json ./services/platform/
COPY packages/landing-kit/package.json ./packages/landing-kit/
COPY apps/studio/package.json ./apps/studio/
COPY apps/website/package.json ./apps/website/
COPY cloud/package.json ./cloud/

# postinstall (prisma generate) precisa do schema — gera depois do COPY
RUN npm ci --ignore-scripts

COPY services/platform ./services/platform
COPY packages/landing-kit ./packages/landing-kit

RUN npx prisma generate --schema=services/platform/prisma/schema.prisma

FROM base AS production
RUN npm run build -w @namao/landing-kit \
  && npm run build -w @namao/platform \
  && mkdir -p /app/services/platform/storage/leads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=services/platform/prisma/schema.prisma && npm start"]
