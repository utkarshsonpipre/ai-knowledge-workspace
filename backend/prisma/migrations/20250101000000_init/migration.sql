-- pgvector must exist before any vector column is created.
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AIRequestType" AS ENUM ('SUMMARIZE', 'REWRITE', 'GENERATE', 'CHAT');
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ChunkSource" AS ENUM ('DOCUMENT', 'FILE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    "plain_text" TEXT NOT NULL DEFAULT '',
    "summary" JSONB,
    "icon" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_id" TEXT,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "embedding" vector(384),
    "source" "ChunkSource" NOT NULL DEFAULT 'DOCUMENT',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "token_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT,
    "type" "AIRequestType" NOT NULL,
    "status" "AIRequestStatus" NOT NULL DEFAULT 'PENDING',
    "input" TEXT NOT NULL,
    "output" TEXT,
    "result" JSONB,
    "error" TEXT,
    "job_id" TEXT,
    "tokens_used" INTEGER,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE INDEX "documents_user_id_updated_at_idx" ON "documents"("user_id", "updated_at");
CREATE UNIQUE INDEX "files_document_id_key" ON "files"("document_id");
CREATE INDEX "files_user_id_created_at_idx" ON "files"("user_id", "created_at");
CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");
CREATE INDEX "document_chunks_file_id_idx" ON "document_chunks"("file_id");
CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Full-text search: Postgres maintains the tsvector itself, so it can never
-- drift from title/plain_text. Title weighted above body.
ALTER TABLE "documents"
    ADD COLUMN "search_vector" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("plain_text", '')), 'B')
    ) STORED;

CREATE INDEX "documents_search_vector_idx" ON "documents" USING GIN ("search_vector");

-- ANN index for semantic search. HNSW over cosine distance: sub-linear recall
-- without the "must train on existing rows" caveat of IVFFlat.
CREATE INDEX "document_chunks_embedding_idx"
    ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
