import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { accessibleDocumentsWhere } from "@/lib/access";
import { StatusPoller } from "@/components/status-poller";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { iconForTitle } from "@/lib/file-icon";
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
    <main className="flex-1 px-8 py-8 max-w-6xl mx-auto w-full">
      <StatusPoller active={hasPending} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewDocumentButton />
          <ButtonLink href="/upload">Upload</ButtonLink>
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          description="Upload your first file to get started — PDFs, Word docs, and text files are all supported."
          action={<ButtonLink href="/upload">Upload a document</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const Icon = iconForTitle(doc.title);
            return (
              <Link key={doc.id} href={`/documents/${doc.id}`} className="group">
                <Card className="h-full p-4 flex flex-col gap-3 transition-shadow hover:shadow-md hover:border-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft shrink-0">
                      <Icon className="h-[18px] w-[18px] text-accent" />
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                      {doc.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 truncate">
                      {doc.ownerEmail} · {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
