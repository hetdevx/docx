"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Share2, Trash2, X, XCircle } from "lucide-react";

type AccessRow = { email: string; permission: "read" | "edit" };

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function DocumentDetailActions({
  documentId,
  editable,
  isPublic,
  access,
}: {
  documentId: string;
  editable: boolean;
  isPublic: boolean;
  access: AccessRow[];
}) {
  const router = useRouter();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [publicState, setPublicState] = useState(isPublic);
  const [shareEmails, setShareEmails] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "edit">("read");
  const [rows, setRows] = useState(access);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyShared = new Set(rows.map((r) => r.email));
  const pendingEmails = parseEmails(shareEmails);
  const newCount = pendingEmails.filter((e) => !alreadyShared.has(e)).length;
  const updateCount = pendingEmails.length - newCount;

  async function shareRequest(body: Record<string, unknown>) {
    const res = await fetch(`/api/documents/${documentId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update sharing");
    }
    const { document } = await res.json();
    return document;
  }

  function applyRows(document: { access: { userEmail: string; permission: "read" | "edit" }[] }) {
    setRows(document.access.map((a) => ({ email: a.userEmail, permission: a.permission })));
  }

  async function handlePermissionChange(email: string, permission: "read" | "edit") {
    setBusy(true);
    setError(null);
    try {
      applyRows(await shareRequest({ email, permission }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(email: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove access");
      }
      const { document } = await res.json();
      applyRows(document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove access");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePublic(checked: boolean) {
    setBusy(true);
    setError(null);
    try {
      const document = await shareRequest({ isPublic: checked });
      setPublicState(document.isPublic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (pendingEmails.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let document;
      for (const email of pendingEmails) {
        document = await shareRequest({ email, permission: sharePermission });
      }
      if (document) applyRows(document);
      setShareEmails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/documents");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/documents/${documentId}/download`}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        {editable && (
          <>
            <button
              onClick={() => setSharePanelOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border ${
                sharePanelOpen
                  ? "border-zinc-950 dark:border-zinc-50 text-zinc-950 dark:text-zinc-50"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </>
        )}
      </div>

      {editable && sharePanelOpen && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Sharing
            </h2>
            <button onClick={() => setSharePanelOpen(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={publicState}
              disabled={busy}
              onChange={(e) => handleTogglePublic(e.target.checked)}
            />
            Share with everyone in the office
          </label>

          <div className="space-y-2">
            <textarea
              placeholder="colleague@company.com, another@company.com&#10;(comma or newline separated — add as many as you like)"
              value={shareEmails}
              onChange={(e) => setShareEmails(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm resize-y"
            />
            <div className="flex items-center gap-2">
              <select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value as "read" | "edit")}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              >
                <option value="read">Can read</option>
                <option value="edit">Can edit</option>
              </select>
              <button
                disabled={busy || pendingEmails.length === 0}
                onClick={handleShare}
                className="rounded-md bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {pendingEmails.length > 1 ? `Share with ${pendingEmails.length}` : "Share"}
              </button>
            </div>
            {updateCount > 0 && (
              <p className="text-xs text-zinc-500">
                {updateCount === 1
                  ? "1 of these is already shared — their permission will be updated."
                  : `${updateCount} of these are already shared — their permissions will be updated.`}
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              {rows.map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.email}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={r.permission}
                      disabled={busy}
                      onChange={(e) =>
                        handlePermissionChange(r.email, e.target.value as "read" | "edit")
                      }
                      className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-1.5 py-0.5 text-xs"
                    >
                      <option value="read">Can read</option>
                      <option value="edit">Can edit</option>
                    </select>
                    <button
                      onClick={() => handleRemove(r.email)}
                      disabled={busy}
                      title="Remove access"
                      className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
