import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";
import { canRead } from "@/lib/access";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]/download">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { access: true },
    });

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (!canRead(user, doc)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await getObjectBuffer(doc.storagePath);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.title}"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Download failed" }, { status: 500 });
  }
}
