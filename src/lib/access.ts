import type { Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";

type DocumentWithAccess = {
  ownerEmail: string;
  isPublic: boolean;
  access: { userEmail: string; permission: "read" | "edit" }[];
};

export function canRead(user: SessionPayload, doc: DocumentWithAccess): boolean {
  if (user.orgRole === "admin") return true;
  if (doc.ownerEmail === user.email) return true;
  if (doc.isPublic) return true;
  return doc.access.some((a) => a.userEmail === user.email);
}

export function canEdit(user: SessionPayload, doc: DocumentWithAccess): boolean {
  if (user.orgRole === "admin") return true;
  if (doc.ownerEmail === user.email) return true;
  return doc.access.some(
    (a) => a.userEmail === user.email && a.permission === "edit",
  );
}

/** Prisma `where` clause for documents a user can see, for use in list/search queries. */
export function accessibleDocumentsWhere(
  user: SessionPayload,
): Prisma.DocumentWhereInput {
  if (user.orgRole === "admin") return {};

  return {
    OR: [
      { ownerEmail: user.email },
      { isPublic: true },
      { access: { some: { userEmail: user.email } } },
    ],
  };
}
