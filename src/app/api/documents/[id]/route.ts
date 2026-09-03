import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]">,
) {
  try {
    const { id } = await params;
    await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { title },
    });

    return Response.json({ document: updated });
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
    return Response.json({ error: "Rename failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]">,
) {
  try {
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "edit");

    await deleteObject(doc.storagePath);
    await prisma.document.delete({ where: { id } });

    return Response.json({ ok: true });
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
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
