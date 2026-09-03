import { getObjectBuffer } from "@/lib/storage";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError } from "@/lib/require-user";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]/images/[filename]">,
) {
  try {
    const { id, filename } = await params;
    await loadDocumentOrThrow(id, "read");

    const buffer = await getObjectBuffer(`docs/${id}/images/${filename}`);
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png" ? "image/png"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : "image/jpeg";

    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=31536000" },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
