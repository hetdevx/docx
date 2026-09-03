import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { accessibleDocumentsWhere } from "@/lib/access";
import { STATUS_STYLES } from "@/lib/status-styles";
import { StatusPoller } from "@/components/status-poller";
import { NewDocumentButton } from "./new-document-button";

const PENDING_STATUSES = new Set(["pending", "processing"]);

export default async function DocumentsPage() {
  const user = await requireUser();

  const documents = await prisma.document.findMany({
    where: accessibleDocumentsWhere(user),
    orderBy: { uploadedAt: "desc" },
  });

  const hasPending = documents.some((d) => PENDING_STATUSES.has(d.status));

  return (
    <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
      <StatusPoller active={hasPending} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Documents
        </h1>
        <div className="flex items-center gap-2">
          <NewDocumentButton />
          <Link
            href="/upload"
            className="rounded bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-3 py-1.5 text-sm font-medium"
          >
            Upload
          </Link>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No documents yet.{" "}
          <Link href="/upload" className="underline">
            Upload your first one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          {documents.map((doc) => (
            <li key={doc.id} className="p-4 flex items-center justify-between">
              <Link href={`/documents/${doc.id}`} className="min-w-0">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50 truncate">
                  {doc.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {doc.ownerEmail} · {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </Link>
              <span
                className={`shrink-0 ml-4 rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_STYLES[doc.status] ?? STATUS_STYLES.pending
                }`}
              >
                {doc.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
