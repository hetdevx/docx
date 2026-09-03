import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";
import { EMBED_QUEUE_NAME, type EmbedJobData } from "@/lib/queue";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const LOW_CONTENT_WORD_THRESHOLD = 30;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function processJob(job: Job<EmbedJobData>) {
  const { documentId } = job.data;

  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "processing", statusReason: null },
  });

  try {
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
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "failed", statusReason: reason },
    });
    console.error(`[worker] document ${documentId} failed:`, reason);
    throw err;
  }
}

const worker = new Worker<EmbedJobData>(EMBED_QUEUE_NAME, processJob, {
  connection,
  concurrency: 2,
});

worker.on("ready", () => console.log("[worker] listening for embed jobs"));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
