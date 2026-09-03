import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";
import { EMBED_QUEUE_NAME, EMBED_DLQ_NAME, enqueueDlqJob, type EmbedJobData } from "@/lib/queue";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const LOW_CONTENT_WORD_THRESHOLD = 30;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Does the actual extract → chunk → embed work for a document. Idempotent
 * per attempt: any chunks a previous attempt (or a previous manual retry)
 * managed to write before failing are cleared first, so retries — automatic
 * or manual — never leave duplicate chunk rows behind.
 */
async function processDocument(documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "processing", statusReason: null },
  });

  await prisma.$executeRaw`DELETE FROM document_chunks WHERE doc_id = ${documentId}`;

  const buffer = await getObjectBuffer(document.storagePath);
  const text = await extractText(buffer, document.mimeType);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("No extractable text found in document");
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i], "document");
    const vectorLiteral = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO document_chunks (id, doc_id, chunk_text, chunk_index, embedding)
      VALUES (${randomUUID()}, ${documentId}, ${chunks[i]}, ${i}, ${vectorLiteral}::vector)
    `;
  }

  const wordCount = countWords(text);
  const lowContent = wordCount < LOW_CONTENT_WORD_THRESHOLD;

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "ready",
      statusReason: lowContent
        ? "Low text content extracted — this file may be mostly images or diagrams, so search results from it may be limited."
        : null,
    },
  });

  console.log(
    `[worker] document ${documentId} ready (${chunks.length} chunks, ${wordCount} words${lowContent ? ", low content" : ""})`,
  );
}

async function processJob(job: Job<EmbedJobData>) {
  await processDocument(job.data.documentId);
}

function attemptsExhausted(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts;
}

const primaryWorker = new Worker<EmbedJobData>(EMBED_QUEUE_NAME, processJob, {
  connection,
  concurrency: 2,
});

primaryWorker.on("ready", () => console.log("[worker] listening for embed jobs"));

// Only write "failed" — and hand off to the DLQ — once BullMQ has exhausted
// every fast retry for this job. Earlier failures are transient by design
// (that's what attempts+backoff are for) and shouldn't flash a false
// "failed" status at the user while a retry is still pending.
primaryWorker.on("failed", async (job, err) => {
  if (!job) return;
  console.error(`[worker] job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  if (!attemptsExhausted(job)) return;

  await prisma.document.update({
    where: { id: job.data.documentId },
    data: { status: "failed", statusReason: err.message },
  });
  await enqueueDlqJob(job.data.documentId);
  console.log(`[worker] document ${job.data.documentId} moved to DLQ for a delayed retry`);
});

// Consumes the dead-letter queue: a second, much slower retry pass for
// documents whose failure outlasted the primary queue's fast retries. If
// this also exhausts, the document stays "failed" and needs a manual Retry
// from the UI (which re-enqueues on the primary queue with a full attempt
// budget).
const dlqWorker = new Worker<EmbedJobData>(EMBED_DLQ_NAME, processJob, {
  connection,
  concurrency: 1,
});

dlqWorker.on("ready", () => console.log("[worker] listening for DLQ retries"));

dlqWorker.on("failed", async (job, err) => {
  if (!job) return;
  console.error(`[worker] DLQ job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  if (!attemptsExhausted(job)) return;

  await prisma.document.update({
    where: { id: job.data.documentId },
    data: {
      status: "failed",
      statusReason: `${err.message} (automatic retries exhausted — use Retry to try again)`,
    },
  });
  console.log(`[worker] document ${job.data.documentId} exhausted DLQ retries`);
});

process.on("SIGTERM", async () => {
  await Promise.all([primaryWorker.close(), dlqWorker.close()]);
  process.exit(0);
});
