import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as {
  connection: IORedis | undefined;
  embedQueue: Queue | undefined;
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

export const embedQueue =
  globalForRedis.embedQueue ??
  new Queue(EMBED_QUEUE_NAME, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.connection = connection;
  globalForRedis.embedQueue = embedQueue;
}

export type EmbedJobData = { documentId: string };

export function enqueueEmbedJob(documentId: string) {
  return embedQueue.add("embed", { documentId } satisfies EmbedJobData);
}
