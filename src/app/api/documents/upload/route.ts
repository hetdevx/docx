import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { processDocument } from "@/lib/process-document";
import { requireUser, UnauthorizedError } from "@/lib/require-user";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  isAllowedMimeType,
} from "@/lib/upload-constraints";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedMimeType(file.type)) {
      return Response.json(
        {
          error: `Unsupported file type "${file.type}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${randomUUID()}-${file.name}`;

    await uploadFile(storagePath, buffer, file.type);

    const document = await prisma.document.create({
      data: {
        title: file.name,
        ownerEmail: user.email,
        storagePath,
        mimeType: file.type,
        size: file.size,
        access: {
          create: { userEmail: user.email, permission: "edit" },
        },
      },
    });

    await processDocument(document.id);

    return Response.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
