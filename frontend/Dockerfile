FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter @kw/frontend...

FROM deps AS build
COPY frontend/ frontend/
# NEXT_PUBLIC_* is inlined at build time, so it must be present here.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    DOCKER_BUILD=true
RUN pnpm --filter @kw/frontend build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
# `output: standalone` bundles only the server files it actually needs.
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
