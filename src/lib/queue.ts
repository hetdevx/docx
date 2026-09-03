import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as {
  connection: IORedis | undefined;
  embedQueue: Queue | undefined;
  embedDlqQueue: Queue | undefined;
};

const connection =
  globalForRedis.connection ??
  new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

// Redis is unreachable by design during `next build` (its hostname only
// resolves inside the docker-compose network); avoid noisy unhandled logs.
connection.on("error", () => {});

export const EMBED_QUEUE_NAME = "embed-document";
export const EMBED_DLQ_NAME = "embed-document-dlq";

export const embedQueue =
  globalForRedis.embedQueue ??
  new Queue(EMBED_QUEUE_NAME, { connection });

// Dead-letter queue: jobs land here after the primary queue exhausts its
// fast retries. A separate consumer (src/worker/index.ts) drains it with
// fewer attempts and a much longer backoff, so a transient outage (Ollama
// restarting, a network blip) that outlasts the primary queue's ~10s of
// retries still gets a second wind minutes later before we give up and
// require a manual Retry from the UI.
export const embedDlqQueue =
  globalForRedis.embedDlqQueue ??
  new Queue(EMBED_DLQ_NAME, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.connection = connection;
  globalForRedis.embedQueue = embedQueue;
  globalForRedis.embedDlqQueue = embedDlqQueue;
}

export type EmbedJobData = { documentId: string };

export function enqueueEmbedJob(documentId: string) {
  return embedQueue.add("embed", { documentId } satisfies EmbedJobData, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export function enqueueDlqJob(documentId: string) {
  return embedDlqQueue.add("embed-retry", { documentId } satisfies EmbedJobData, {
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    delay: 60_000,
    removeOnComplete: true,
    removeOnFail: true,
  });
}
