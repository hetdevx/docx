"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function NewDocumentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setTitle("");
    setDescription("");
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setBusy(true);
    setError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim() }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create document");
      return;
    }

    const { document } = await res.json();
    router.push(`/documents/${document.id}`);
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        New Document
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">New document</h2>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="text-zinc-400 hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              autoFocus
              type="text"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") reset();
              }}
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              AI description
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <Textarea
              placeholder="Describe what this document is for — the doc still starts blank, but AI features inside it (Enhance, the prompt bar) will use this as context."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="mt-1 text-xs text-zinc-500">
              The document starts blank either way — this just helps AI stay on-brief later.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-sm text-zinc-500 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
