import { getObjectBuffer } from "@/lib/storage";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]/download">,
) {
  try {
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "read");

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
    if (err instanceof NotFoundError) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return Response.json({ error: "Download failed" }, { status: 500 });
  }
}
