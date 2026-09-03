import { prisma } from "@/lib/prisma";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/share">,
) {
  try {
    const { id } = await params;
    await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);

    if (typeof body?.isPublic === "boolean") {
      await prisma.document.update({
        where: { id },
        data: { isPublic: body.isPublic },
      });
    }

    if (typeof body?.email === "string" && body.email.trim()) {
      const permission = body.permission === "edit" ? "edit" : "read";
      await prisma.documentAccess.upsert({
        where: {
          docId_userEmail: { docId: id, userEmail: body.email.trim().toLowerCase() },
        },
        update: { permission },
        create: {
          docId: id,
          userEmail: body.email.trim().toLowerCase(),
          permission,
        },
      });
    }

    const updated = await prisma.document.findUnique({
      where: { id },
      include: { access: true },
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
    return Response.json({ error: "Share failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/share">,
) {
  try {
    const { id } = await params;
    await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return Response.json({ error: "email is required" }, { status: 400 });
    }

    await prisma.documentAccess.deleteMany({
      where: { docId: id, userEmail: email },
    });

    const updated = await prisma.document.findUnique({
      where: { id },
      include: { access: true },
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
    return Response.json({ error: "Failed to remove access" }, { status: 500 });
  }
}
