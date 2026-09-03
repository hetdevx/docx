"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { scrollToAndHighlight } from "@/lib/find-in-dom";
import { Button } from "@/components/ui/button";

export function ContentViewer({
  documentId,
  highlightQuery,
}: {
  documentId: string;
  highlightQuery?: string;
}) {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightMissed, setHighlightMissed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState("");
  const [editable, setEditable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [stats, setStats] = useState({ words: 0, characters: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/content`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load content");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.previewUnavailable) {
          setPreviewUnavailable(true);
          return;
        }
        setHtml(data.html);
        setEditable(data.editable);
        // New/empty documents open straight into edit mode.
        if (data.editable && !data.html) setEditing(true);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load document content");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (loading || previewUnavailable || !highlightQuery || !containerRef.current) return;
    // Wait a tick for the editor to actually paint before searching its DOM.
    const timer = setTimeout(() => {
      const target = containerRef.current?.querySelector<HTMLElement>(".tiptap-content");
      if (!target) return;
      const found = scrollToAndHighlight(target, highlightQuery);
      if (!found) setHighlightMissed(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [loading, previewUnavailable, highlightQuery]);

  async function handleSave() {
    const newHtml = editorRef.current?.getHTML() ?? html;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: newHtml }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }

    setHtml(newHtml);
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    editorRef.current?.reset();
    setEditing(false);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading content...</p>;
  }

  if (previewUnavailable) {
    return (
      <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center">
        <p className="text-sm text-zinc-500">
          A preview isn&apos;t available for this file. Use Download above to
          get the original file.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      {highlightMissed && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Couldn&apos;t locate that exact excerpt in the current content — it
          may have changed since it was indexed.
        </p>
      )}
      <div className="flex items-center justify-end gap-2 h-9">
        {editable && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {editable && editing && (
          <>
            <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </div>

      {!editable && (
        <p className="text-xs text-zinc-500 -mt-1">
          This is a read-only preview of the extracted text — editing isn&apos;t
          supported for this file type. Use Download for the original file.
        </p>
      )}

      <RichTextEditor
        ref={editorRef}
        content={html}
        editable={editing}
        documentId={documentId}
        onStatsChange={setStats}
      />

      {editing && (
        <p className="text-xs text-zinc-400 text-right">
          {stats.words} words · {stats.characters} characters
        </p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
