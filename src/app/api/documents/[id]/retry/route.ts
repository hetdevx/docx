import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/process-document";
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

    await processDocument(id);
    const document = await prisma.document.findUniqueOrThrow({ where: { id } });

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
