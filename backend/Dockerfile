# Build context is the repo root so the pnpm workspace stays intact.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# openssl: required by the Prisma query engine on Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---- dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
# The schema must exist before install: `postinstall` runs `prisma generate`.
COPY backend/prisma backend/prisma
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm install --frozen-lockfile --filter @kw/backend...

# ---- build -----------------------------------------------------------------
FROM deps AS build
COPY backend/ backend/
RUN pnpm --filter @kw/backend build

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/backend
EXPOSE 4000
# Migrations run on boot so a fresh environment is usable without a manual step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
