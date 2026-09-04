import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer, uploadFile } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";
import { convertPdfToDocx } from "@/lib/convert-pdf-to-docx";
import { DOCX_MIME_TYPE } from "@/lib/upload-constraints";

const LOW_CONTENT_WORD_THRESHOLD = 30;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts, chunks, and embeds a document's content, then marks it ready —
 * or failed, with the reason recorded, if any step throws. Runs inline in
 * the request that triggered it (upload, save, retry): this app has no
 * queue/worker process, so a failure here is recoverable only through the
 * manual Retry action, not an automatic background backoff.
 *
 * Idempotent: clears any chunks a previous attempt left behind first, so
 * retries (manual, or a re-save) never leave duplicate chunk rows.
 */
export async function processDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "processing", statusReason: null },
  });

  try {
    await prisma.$executeRaw`DELETE FROM document_chunks WHERE doc_id = ${documentId}`;

    let buffer = await getObjectBuffer(document.storagePath);
    let mimeType = document.mimeType;

    // PDFs have no reversible editable-HTML path (extraction loses all
    // structure), so convert them to a real DOCX first and let the rest of
    // the pipeline treat the document as DOCX from here on — same file
    // going forward, in storage and in the DB.
    if (mimeType === "application/pdf") {
      const docx = await convertPdfToDocx(buffer);
      mimeType = DOCX_MIME_TYPE;
      await uploadFile(document.storagePath, docx, mimeType);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          mimeType,
          size: docx.byteLength,
          title: document.title.replace(/\.pdf$/i, ".docx"),
        },
      });
      buffer = docx;
    }

    const text = await extractText(buffer, mimeType);
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
      `[process-document] ${documentId} ready (${chunks.length} chunks, ${wordCount} words${lowContent ? ", low content" : ""})`,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "failed", statusReason: reason },
    });
    console.error(`[process-document] ${documentId} failed:`, reason);
  }
}
