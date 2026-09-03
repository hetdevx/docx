"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

export function TitleEditor({
  documentId,
  title,
  editable,
}: {
  documentId: string;
  title: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit() {
    const trimmed = value.trim();
    setEditing(false);

    if (!trimmed || trimmed === title) {
      setValue(title);
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setSaving(false);

    if (!res.ok) {
      setValue(title);
      return;
    }

    router.refresh();
  }

  if (!editable) {
    return (
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.blur();
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50 bg-transparent border-b-2 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-50 -ml-0.5 px-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
    >
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h1>
      <Pencil className="h-4 w-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
