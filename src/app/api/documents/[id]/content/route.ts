import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer, uploadFile } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { enqueueEmbedJob } from "@/lib/queue";
import { canRead, canEdit } from "@/lib/access";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// mammoth can convert DOCX to HTML preserving basic formatting, so it can
// go through the same "edit → promotes to text/html" flow as .txt. PDF has
// no equivalent path (extraction loses all structure), so it stays read-only.
const EDITABLE_MIME_TYPES = ["text/plain", "text/html", DOCX_MIME_TYPE];

/** TipTap's `content` prop is parsed as HTML, so plain text needs escaping first. */
function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/documents/[id]/content">,
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
    const raw = buffer.toString("utf-8");

    let html: string;
    try {
      if (doc.mimeType === "text/html") {
        html = raw;
      } else if (doc.mimeType === "text/plain") {
        html = plainTextToHtml(raw);
      } else if (doc.mimeType === DOCX_MIME_TYPE) {
        html = (await mammoth.convertToHtml({ buffer })).value;
      } else {
        html = plainTextToHtml(await extractText(buffer, doc.mimeType));
      }
    } catch (extractErr) {
      console.error(`[content] extraction failed for ${doc.id}:`, extractErr);
      return Response.json({
        html: null,
        editable: false,
        previewUnavailable: true,
      });
    }

    return Response.json({
      html,
      editable: EDITABLE_MIME_TYPES.includes(doc.mimeType) && canEdit(user, doc),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Failed to load document content" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/content">,
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

    if (!EDITABLE_MIME_TYPES.includes(doc.mimeType)) {
      return Response.json(
        { error: "This file type can't be edited" },
        { status: 400 },
      );
    }

    if (!canEdit(user, doc)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (typeof body?.html !== "string") {
      return Response.json({ error: "html is required" }, { status: 400 });
    }

    const buffer = Buffer.from(body.html, "utf-8");
    await uploadFile(doc.storagePath, buffer, "text/html");

    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where: { docId: id } }),
      prisma.document.update({
        where: { id },
        data: {
          mimeType: "text/html",
          size: buffer.byteLength,
          status: "pending",
          statusReason: null,
        },
      }),
    ]);

    await enqueueEmbedJob(id);

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Failed to save document" }, { status: 500 });
  }
}
