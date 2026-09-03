import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    // The doc always starts empty — the AI description isn't used to draft
    // content up front. It's stored as `aiBrief` and only comes into play
    // later, as context for Enhance with AI / the in-editor prompt bar.
    const storagePath = `${randomUUID()}-${title}.html`;
    await uploadFile(storagePath, Buffer.from(""), "text/html");

    const document = await prisma.document.create({
      data: {
        title,
        ownerEmail: user.email,
        storagePath,
        mimeType: "text/html",
        size: 0,
        status: "ready",
        aiBrief: description || null,
        access: {
          create: { userEmail: user.email, permission: "edit" },
        },
      },
    });

    return Response.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Failed to create document" }, { status: 500 });
  }
}
