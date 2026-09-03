import { notFound } from "next/navigation";
import { CalendarDays, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { canRead, canEdit } from "@/lib/access";
import { StatusBadge } from "@/components/ui/badge";
import { StatusPoller } from "@/components/status-poller";
import { DocumentDetailActions } from "./actions";
import { ContentViewer } from "./content-viewer";
import { TitleEditor } from "./title-editor";

export default async function DocumentDetailPage(
  { params, searchParams }: PageProps<"/documents/[id]">,
) {
  const user = await requireUser();
  const { id } = await params;
  const { q } = await searchParams;
  const highlightQuery = typeof q === "string" ? q : undefined;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { access: true },
  });

  if (!doc || !canRead(user, doc)) {
    notFound();
  }

  const editable = canEdit(user, doc);

  const statusPending = doc.status === "pending" || doc.status === "processing";

  return (
    <main className="flex-1 px-8 py-10 max-w-4xl mx-auto w-full">
      <StatusPoller active={statusPending} />
      <div className="mb-8 pb-6 border-b border-border-subtle space-y-3">
        <div className="flex items-start justify-between gap-4">
          <TitleEditor documentId={doc.id} title={doc.title} editable={editable} />
          <div className="shrink-0 mt-1.5">
            <StatusBadge status={doc.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {doc.ownerEmail}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        {doc.statusReason && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{doc.statusReason}</p>
        )}

        <DocumentDetailActions
          documentId={doc.id}
          editable={editable}
          isPublic={doc.isPublic}
          access={doc.access.map((a) => ({ email: a.userEmail, permission: a.permission }))}
          status={doc.status}
        />
      </div>

      <ContentViewer documentId={doc.id} highlightQuery={highlightQuery} />
    </main>
  );
}
