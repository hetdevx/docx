import { prisma } from "@/lib/prisma";
import { enqueueEmbedJob } from "@/lib/queue";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]/retry">,
) {
  try {
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "edit");

    if (doc.status !== "failed") {
      return Response.json(
        { error: "Only failed documents can be retried" },
        { status: 400 },
      );
    }

    // Clear out any chunks a previous attempt may have partially written
    // before re-queuing, so a later success doesn't leave duplicates behind.
    await prisma.$executeRaw`DELETE FROM document_chunks WHERE doc_id = ${id}`;

    const document = await prisma.document.update({
      where: { id },
      data: { status: "pending", statusReason: null },
    });

    await enqueueEmbedJob(id);

    return Response.json({ document });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof NotFoundError) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return Response.json({ error: "Retry failed" }, { status: 500 });
  }
}
