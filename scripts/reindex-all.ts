// One-off tool: re-extract, re-chunk, and re-embed every document. Useful
// after any change to extract-text.ts, chunk.ts, or the embedding model
// (a different model/dimension makes existing chunks incomparable to new
// query embeddings, so they need regenerating, not just appending to).
import { prisma } from "../src/lib/prisma";
import { processDocument } from "../src/lib/process-document";

async function main() {
  const docs = await prisma.document.findMany({
    where: { status: { in: ["ready", "failed"] }, size: { gt: 0 } },
    select: { id: true, title: true },
  });

  console.log(`Re-indexing ${docs.length} document(s)...`);

  for (const doc of docs) {
    await processDocument(doc.id);
    console.log(`Done: ${doc.title}`);
  }

  console.log("All documents re-indexed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
