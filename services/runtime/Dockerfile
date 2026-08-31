FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY services/runtime/package.json ./services/runtime/
COPY services/platform/package.json ./services/platform/
COPY apps/studio/package.json ./apps/studio/
COPY packages/landing-kit/package.json ./packages/landing-kit/

RUN npm ci --ignore-scripts --workspace=@namao/runtime --include-workspace-root

COPY services/platform/prisma ./services/platform/prisma
COPY services/runtime ./services/runtime

RUN chmod +x services/runtime/docker-entrypoint.dev.sh \
  && npx prisma generate --schema=services/platform/prisma/schema.prisma \
  && MONGODB_URL="mongodb://localhost:27017/namao" npx prisma generate --schema=services/runtime/prisma/schema.prisma

FROM base AS development
ENV NODE_ENV=development
ENV PORT=3001
EXPOSE 3001
CMD ["sh", "/app/services/runtime/docker-entrypoint.dev.sh"]

FROM base AS production
RUN npm run build -w @namao/runtime

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start:prod", "-w", "@namao/runtime"]
