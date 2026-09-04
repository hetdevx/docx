import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer, uploadFile } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { processDocument } from "@/lib/process-document";
import { canEdit } from "@/lib/access";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";
import { DOCX_MIME_TYPE } from "@/lib/upload-constraints";

// mammoth can convert DOCX to HTML preserving basic formatting, so it can
// go through the same "edit → promotes to text/html" flow as .txt. PDFs are
// converted to DOCX at processing time (see convertPdfToDocx in
// process-document.ts), so by the time a document reaches this route its
// mimeType is never still "application/pdf" — this list has no PDF case.
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
    const { id } = await params;
    const { user, doc } = await loadDocumentOrThrow(id, "read");

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
    if (err instanceof NotFoundError) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
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
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "edit");

    if (!EDITABLE_MIME_TYPES.includes(doc.mimeType)) {
      return Response.json(
        { error: "This file type can't be edited" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    if (typeof body?.html !== "string") {
      return Response.json({ error: "html is required" }, { status: 400 });
    }

    const buffer = Buffer.from(body.html, "utf-8");
    await uploadFile(doc.storagePath, buffer, "text/html");

    await prisma.document.update({
      where: { id },
      data: { mimeType: "text/html", size: buffer.byteLength },
    });

    await processDocument(id);

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
    return Response.json({ error: "Failed to save document" }, { status: 500 });
  }
}
