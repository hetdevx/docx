import { prisma } from "@/lib/prisma";
import { canRead, canEdit } from "@/lib/access";
import { requireUser, ForbiddenError, NotFoundError } from "@/lib/require-user";
import type { SessionPayload } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

type DocumentWithAccess = Prisma.DocumentGetPayload<{ include: { access: true } }>;

export async function loadDocumentOrThrow(
  id: string,
  mode: "read" | "edit",
): Promise<{ user: SessionPayload; doc: DocumentWithAccess }> {
  const user = await requireUser();

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { access: true },
  });

  if (!doc) throw new NotFoundError("Not found");

  const allowed = mode === "edit" ? canEdit(user, doc) : canRead(user, doc);
  if (!allowed) throw new ForbiddenError("Forbidden");

  return { user, doc };
}
