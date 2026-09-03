import { randomUUID } from "node:crypto";
import { uploadFile } from "@/lib/storage";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/images">,
) {
  try {
    const { id } = await params;
    await loadDocumentOrThrow(id, "edit");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported image type "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return Response.json(
        { error: `Image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}-${file.name}`;
    const key = `docs/${id}/images/${filename}`;

    await uploadFile(key, buffer, file.type);

    // filename only — the GET route reconstructs the full storage key from
    // the doc id in its own path plus this, so the two stay in sync.
    return Response.json({ url: `/api/documents/${id}/images/${filename}` }, { status: 201 });
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
    return Response.json({ error: "Image upload failed" }, { status: 500 });
  }
}
