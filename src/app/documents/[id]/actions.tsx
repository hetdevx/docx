"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Share2, Trash2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, Textarea } from "@/components/ui/input";

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
  status,
}: {
  documentId: string;
  editable: boolean;
  isPublic: boolean;
  access: AccessRow[];
  status: string;
}) {
  const router = useRouter();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [publicState, setPublicState] = useState(isPublic);
  const [shareEmails, setShareEmails] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "edit">("read");
  const [rows, setRows] = useState(access);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
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

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/retry`, { method: "POST" });
    setRetrying(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Retry failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/documents/${documentId}/download`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors px-3.5 py-2 text-sm bg-accent text-accent-foreground hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        {editable && status === "failed" && (
          <Button onClick={handleRetry} disabled={retrying}>
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Retrying..." : "Retry processing"}
          </Button>
        )}
        {editable && (
          <>
            <Button
              variant={sharePanelOpen ? "primary" : "secondary"}
              onClick={() => setSharePanelOpen((o) => !o)}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        )}
      </div>

      {editable && sharePanelOpen && (
        <Card className="p-4 space-y-4 bg-background/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Sharing
            </h2>
            <button onClick={() => setSharePanelOpen(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <Checkbox
              checked={publicState}
              disabled={busy}
              onChange={(e) => handleTogglePublic(e.target.checked)}
            />
            Share with everyone in the office
          </label>

          <div className="space-y-2">
            <Textarea
              placeholder="colleague@company.com, another@company.com&#10;(comma or newline separated — add as many as you like)"
              value={shareEmails}
              onChange={(e) => setShareEmails(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value as "read" | "edit")}
                className="w-auto"
              >
                <option value="read">Can read</option>
                <option value="edit">Can edit</option>
              </Select>
              <Button disabled={busy || pendingEmails.length === 0} onClick={handleShare}>
                {pendingEmails.length > 1 ? `Share with ${pendingEmails.length}` : "Share"}
              </Button>
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
                    <Select
                      value={r.permission}
                      disabled={busy}
                      onChange={(e) =>
                        handlePermissionChange(r.email, e.target.value as "read" | "edit")
                      }
                      className="w-auto py-1 text-xs"
                    >
                      <option value="read">Can read</option>
                      <option value="edit">Can edit</option>
                    </Select>
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
        </Card>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
