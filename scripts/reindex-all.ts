// One-off migration: existing chunks were embedded without the
// search_document:/search_query: task prefix nomic-embed-text requires.
// Clear all chunks and re-enqueue every document for embedding so the
// whole index is consistent with the corrected embeddings.ts.
import { prisma } from "../src/lib/prisma";
import { enqueueEmbedJob } from "../src/lib/queue";

async function main() {
  const docs = await prisma.document.findMany({
    where: { status: { in: ["ready", "failed"] } },
    select: { id: true, title: true },
  });

  console.log(`Re-indexing ${docs.length} document(s)...`);

  await prisma.documentChunk.deleteMany({
    where: { docId: { in: docs.map((d) => d.id) } },
  });

  await prisma.document.updateMany({
    where: { id: { in: docs.map((d) => d.id) } },
    data: { status: "pending", statusReason: null },
  });

  for (const doc of docs) {
    await enqueueEmbedJob(doc.id);
    console.log(`Enqueued: ${doc.title}`);
  }

  console.log("Done. Run the worker to process the queue.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
