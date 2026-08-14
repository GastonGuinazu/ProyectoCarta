# syntax=docker/dockerfile:1
# NestJS long-running process. Not for Vercel Functions (docs/hosting.md).

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY prisma ./prisma

RUN npm ci --workspace=api --include-workspace-root

COPY apps/api ./apps/api
RUN npx prisma generate
RUN npm run build --workspace=api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY prisma ./prisma
COPY scripts/api-entrypoint.mjs ./scripts/api-entrypoint.mjs

RUN npm ci --omit=dev --workspace=api --include-workspace-root \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3000
# migrate deploy (DIRECT_URL, puerto 5432) and then Nest. Not a Vercel Function.
CMD ["node", "/app/scripts/api-entrypoint.mjs"]
