import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { canRead, canEdit } from "@/lib/access";
import { STATUS_STYLES } from "@/lib/status-styles";
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
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full">
      <StatusPoller active={statusPending} />
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <TitleEditor documentId={doc.id} title={doc.title} editable={editable} />
          <span
            className={`shrink-0 mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[doc.status] ?? STATUS_STYLES.pending
            }`}
          >
            {doc.status}
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          {doc.ownerEmail} · {new Date(doc.uploadedAt).toLocaleDateString()}
        </p>
        {doc.statusReason && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{doc.statusReason}</p>
        )}

        <DocumentDetailActions
          documentId={doc.id}
          editable={editable}
          isPublic={doc.isPublic}
          access={doc.access.map((a) => ({ email: a.userEmail, permission: a.permission }))}
        />
      </div>

      <ContentViewer documentId={doc.id} highlightQuery={highlightQuery} />
    </main>
  );
}
