"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { iconForTitle } from "@/lib/file-icon";

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
    <main className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold text-foreground mb-1">Search</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Ask a question and get an AI-generated answer sourced from your documents.
      </p>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex items-stretch gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Ask about your docs..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-11 shrink-0">
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <Checkbox
            checked={plainMode}
            onChange={(e) => setPlainMode(e.target.checked)}
          />
          Plain search (skip AI answer)
        </label>
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
                <Card className="p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="flex items-center gap-1 rounded-full bg-accent-soft text-accent px-2 py-0.5 text-xs font-medium">
                      <Sparkles className="h-3 w-3" />
                      AI answer
                    </span>
                  </div>
                  <div className="ai-answer text-sm text-zinc-800 dark:text-zinc-200">
                    <ReactMarkdown components={markdownComponents}>
                      {result.answer}
                    </ReactMarkdown>
                  </div>
                </Card>
              )}
            </div>
          )}

          {result.sources.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches found"
              description="No sufficiently relevant documents were found for this question."
            />
          ) : (
            <div>
              <h2 className="text-sm font-medium text-zinc-500 mb-2">Sources</h2>
              <div className="space-y-3">
                {result.sources.map((s, i) => {
                  const Icon = iconForTitle(s.title);
                  return (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                          <Icon className="h-4 w-4 text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/documents/${s.documentId}`}
                            className="text-sm font-medium text-foreground hover:text-accent"
                          >
                            {s.title}
                          </Link>
                          <p className="text-xs text-zinc-500 mt-1">{s.excerpt}...</p>
                          <Link
                            href={`/documents/${s.documentId}?q=${encodeURIComponent(s.snippet)}`}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover mt-2"
                          >
                            View in document
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
