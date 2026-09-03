"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

const ACCEPTED = ".pdf,.docx,.txt";

export default function UploadPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    (file: File) => {
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/documents/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setProgress(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          router.push("/documents");
          router.refresh();
        } else {
          try {
            setError(JSON.parse(xhr.responseText).error ?? "Upload failed");
          } catch {
            setError("Upload failed");
          }
        }
      };
      xhr.onerror = () => {
        setProgress(null);
        setError("Upload failed");
      };
      xhr.send(formData);
    },
    [router],
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-foreground text-center mb-1">
          Upload a document
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-6">
          It will be processed and indexed for search automatically.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) upload(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver
              ? "border-accent bg-accent-soft"
              : "border-border-subtle bg-surface hover:border-accent/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
              dragOver ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent"
            }`}
          >
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Drag and drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-zinc-400">PDF, DOCX, or TXT — up to 25MB</p>

          {progress !== null && (
            <div className="mt-4 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </main>
  );
}
