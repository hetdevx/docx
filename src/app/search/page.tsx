"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { MermaidDiagram } from "@/components/mermaid-diagram";

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className ?? "")?.[1];
    if (language === "mermaid") {
      return <MermaidDiagram chart={String(children)} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

type Source = {
  documentId: string;
  title: string;
  excerpt: string;
  snippet: string;
};
type SearchResult = {
  mode: "ai" | "plain";
  answer: string | null;
  answerUnavailable?: boolean;
  sources: Source[];
};

export default function SearchPage() {
  const [question, setQuestion] = useState("");
  const [plainMode, setPlainMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/search${plainMode ? "?mode=plain" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Search failed");
      return;
    }

    setResult(await res.json());
  }

  return (
    <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-semibold mb-6 text-zinc-950 dark:text-zinc-50">
        Search
      </h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <input
          type="text"
          placeholder="Ask about your docs..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm mb-2"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={plainMode}
              onChange={(e) => setPlainMode(e.target.checked)}
            />
            Plain search (skip AI answer)
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          {result.mode === "ai" && (
            <div>
              {result.answerUnavailable ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  AI answer unavailable right now — showing matching excerpts instead.
                </p>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                  <h2 className="text-sm font-medium text-zinc-500 mb-2">AI answer</h2>
                  <div className="text-sm text-zinc-800 dark:text-zinc-200 space-y-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_code]:bg-zinc-100 dark:[&_code]:bg-zinc-900 [&_code]:px-1 [&_code]:rounded">
                    <ReactMarkdown components={markdownComponents}>
                      {result.answer}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {result.sources.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No sufficiently relevant documents found.
            </p>
          ) : (
            <div>
              <h2 className="text-sm font-medium text-zinc-500 mb-2">Sources</h2>
              <ul className="space-y-3">
                {result.sources.map((s, i) => (
                  <li
                    key={i}
                    className="border border-zinc-200 dark:border-zinc-800 rounded p-3"
                  >
                    <Link
                      href={`/documents/${s.documentId}`}
                      className="text-sm font-medium underline text-zinc-950 dark:text-zinc-50"
                    >
                      {s.title}
                    </Link>
                    <p className="text-xs text-zinc-500 mt-1">{s.excerpt}...</p>
                    <Link
                      href={`/documents/${s.documentId}?q=${encodeURIComponent(s.snippet)}`}
                      className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 mt-1 inline-block"
                    >
                      View in document →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
