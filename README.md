# AI-Powered Knowledge Workspace

Single-user knowledge management: write documents in a block editor, upload PDFs
and Word files, search them by keyword *and* by meaning, and ask questions that
are answered from your own content.

Next.js 15 · NestJS 11 · PostgreSQL + pgvector · BullMQ · Socket.IO · Grok (xAI)

---

## What it does

| Area | Detail |
|---|---|
| Auth | GitHub OAuth → JWT. 15-minute access token, 7-day refresh token, rotated on every use, stored httpOnly. Token reuse kills every session for that user. |
| Editor | Tiptap block editor — headings, lists, checklists, code, quotes, images, dividers. `/` slash menu, `Ctrl+K` command palette, `Ctrl+S` save, debounced autosave. |
| Files | PDF / DOCX / TXT / MD uploaded straight to Supabase Storage through a signed URL. Bytes never touch the API server. |
| AI | Provider-agnostic `AIProvider` (Grok today) — summarize, rewrite, generate, chat. Separate `EmbeddingProvider` (local MiniLM or OpenAI). |
| RAG | extract → chunk → embed → pgvector → cosine top-k → grounded answer with citations, streamed token by token. |
| Search | Postgres full-text search (generated `tsvector`, GIN) and pgvector cosine similarity (HNSW), shown side by side. |
| Async | Every AI and file job runs in a BullMQ worker. Progress streams to the browser over Socket.IO. |

---

## Architecture

```
Next.js (Vercel)                      NestJS (Render)              Managed services
┌────────────────────┐   REST/SSE   ┌──────────────────────┐
│ App Router + RQ    │◄────────────►│ auth · users         │
│ Zustand · Tiptap   │              │ documents · files    │──── Supabase Postgres
│ shadcn · cmdk      │   Socket.IO  │ ai · search          │     (relational + pgvector)
│                    │◄────────────►│ queue (BullMQ)       │──── Upstash Redis (TCP)
└─────────┬──────────┘              │ events (gateway)     │
          │  signed PUT             └──────────────────────┘──── Grok / xAI
          └──────────────────────────────────────────────────── Supabase Storage
```

### Decisions worth calling out

**One Postgres for rows and vectors.** pgvector lives in the same Supabase
instance as the relational data, so a chunk and its parent document are joined
in SQL rather than reconciled across two stores. No second database to
provision, back up or keep consistent.

**`AIProvider` and `EmbeddingProvider` are separate interfaces.** Grok has no
embeddings endpoint. Folding embeddings into the text-generation interface would
have produced a method that throws at runtime the moment anyone switched
providers. They are split, so the RAG pipeline keeps working no matter which LLM
is plugged in. Adding OpenAI/Claude/Gemini means writing one class and changing
one `useClass` line in `ai.module.ts`.

**Both embedding providers emit 384 dimensions.** MiniLM is natively 384;
OpenAI's `text-embedding-3-small` is truncated to 384 via its `dimensions`
parameter. The pgvector column is therefore fixed-width and providers stay
swappable without a migration.

**Uploads bypass the API server.** The backend mints a signed upload URL; the
browser PUTs to Supabase directly. A 20 MB PDF costs the API two small JSON
round trips instead of 20 MB of buffered request body.

**Uploaded files become Documents.** Extraction writes the text into a real
`Document` row, so files and hand-written notes share one chunking, search,
summarize and chat code path.

**Streaming chat is the one AI call inside the request cycle.** Everything else
(summarize, rewrite, generate) is queued. An SSE answer *is* the response, so
queueing it would defeat the purpose — the `AIRequest` row is still written for
history.

**The access token is never in a URL.** The OAuth callback sets only the
httpOnly refresh cookie and redirects; the SPA exchanges it for an access token
on load. Nothing sensitive lands in browser history, `Referer` headers or logs.

---

## Repository layout

```
backend/src/
  auth/       GitHub OAuth, JWT strategies, refresh rotation
  users/      profile, preferences, dashboard aggregate
  documents/  CRUD, rename, Tiptap ⇄ plain-text
  files/      signed uploads, Supabase Storage, text extraction
  ai/         AIProvider + EmbeddingProvider, chunking, indexing, RAG
  search/     keyword FTS + semantic search
  queue/      BullMQ producers (queue.module) and workers (worker.module)
  events/     Socket.IO gateway (JWT handshake)
  common/     guards, filters, interceptors, shared DTOs
  prisma/     schema + migrations

frontend/
  app/        App Router — login, callback, (workspace) shell
  components/ ui primitives, sidebar, topbar, command palette
  features/   editor (Tiptap + slash menu), ai (panel + chat), files
  hooks/      React Query hooks
  services/   typed API client incl. SSE stream parser
  store/      Zustand (auth, UI, live job progress)
  lib/        fetch wrapper w/ refresh, socket, supabase, types
```

---

## Running locally

Prerequisites: Node 20+, pnpm 10, Docker.

```bash
pnpm install

# Postgres (pgvector) on host port 5433 + Redis on 6379
pnpm docker:up

cp .env.example backend/.env      # then fill in the values below
pnpm --filter @kw/backend prisma:deploy

pnpm dev                          # backend :4000, frontend :3000
```

> Local Postgres is published on **5433** so it does not collide with any other
> Postgres already running on 5432. Inside docker-compose the backend still
> connects to `postgres:5432`.

### Minimum configuration

| Variable | Where to get it |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_SECRET` | GitHub → Settings → Developer settings → OAuth Apps. Callback URL: `http://localhost:4000/api/auth/github/callback` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Any 32+ character random strings, different from each other |
| `GROK_API_KEY` | console.x.ai |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API. Create a **private** bucket named `knowledge-files`. |
| `REDIS_URL` | Upstash console → the `rediss://` **TCP** endpoint, not the REST URL |

The frontend additionally needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local` for direct uploads.

Embeddings default to `EMBEDDING_PROVIDER=local` (Xenova/all-MiniLM-L6-v2,
~25 MB downloaded on first use, no API key, no cost). Set it to `openai` and
provide `OPENAI_API_KEY` for better recall.

---

## Testing

```bash
pnpm --filter @kw/backend test       # unit: auth rotation, documents, chunking, AI orchestration, search
pnpm --filter @kw/backend test:e2e   # smoke: session → document → upload → worker → summarize
```

The e2e test runs against **real** Postgres and Redis — it proves the queue, the
worker, the pgvector write and the semantic read-back actually work together.
Only the three outbound integrations (object storage, LLM, embeddings) are
stubbed.

---

## Deployment

| Piece | Target | Why |
|---|---|---|
| Frontend | Vercel | Git-integrated, `vercel.json` builds only the `@kw/frontend` workspace |
| Backend | Render (`render.yaml`) | Holds the Socket.IO server and BullMQ workers — needs a long-lived process, not a serverless function |
| Database | Supabase Postgres | pgvector enabled; `DIRECT_URL` (port 5432) for migrations, pooled URL for the app |
| Redis | Upstash | BullMQ needs blocking commands, so the `rediss://` TCP endpoint — the REST client cannot serve it |
| Errors | Sentry | Backend `instrument.ts`, frontend `instrumentation*.ts`; both no-op without a DSN |

CI (`.github/workflows/ci.yml`): install → lint → unit tests → build → e2e
against service containers → Docker image builds → Render deploy hook on `main`.

---

## Notes

- `prisma migrate diff` will always report one missing index on
  `document_chunks.embedding`. That is the HNSW vector index, which Prisma's
  schema language cannot express; it lives in the init migration SQL. Do not
  "fix" the drift by dropping it.
- Editing a document re-embeds it, debounced by a fixed BullMQ job id so a burst
  of autosaves collapses into one indexing run.
- Rate limits: 120 req/min globally, 30/min on AI endpoints and token refresh.
