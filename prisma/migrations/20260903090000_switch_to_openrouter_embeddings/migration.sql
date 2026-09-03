-- Switching the embedding provider from Ollama (nomic-embed-text, 768 dims)
-- to OpenRouter (nvidia/llama-nemotron-embed-vl-1b-v2:free, 2048 dims) so
-- the stack can be deployed without a self-hosted Ollama instance.
--
-- Existing chunks are invalidated by the provider change regardless (a
-- 768-dim vector isn't comparable to a 2048-dim one), so this truncates
-- document_chunks and lets the embed queue's normal retry/backfill path
-- (see /api/documents/[id]/retry) repopulate it against the new model.
--
-- pgvector's ivfflat index type has a hard 2000-dimension limit, which
-- 2048 exceeds — the underlying `vector` column type itself supports up to
-- 16000 dimensions, this limit is specific to that ANN index. Dropped
-- rather than replaced with e.g. a halfvec/hnsw index: at the document
-- volumes this app is built for, an exact (sequential-scan) cosine search
-- is plenty fast, and it's a much smaller change than migrating to a
-- different pgvector storage type.
TRUNCATE TABLE "document_chunks";

DROP INDEX IF EXISTS "document_chunks_embedding_idx";

ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(2048);
