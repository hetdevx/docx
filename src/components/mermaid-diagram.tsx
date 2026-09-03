"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    securityLevel: "strict",
  });
  initialized = true;
}

/**
 * Models frequently emit node labels with unquoted parentheses/colons/etc,
 * which breaks Mermaid's parser (e.g. `C[Build image (if tests pass)]`).
 * Quoting is always valid Mermaid syntax, so wrap every bracket/paren node
 * label in double quotes as a best-effort repair before giving up.
 */
function autoQuoteMermaidLabels(chart: string): string {
  const quote = (id: string, open: string, label: string, close: string) => {
    const trimmed = label.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return `${id}${open}${label}${close}`;
    }
    return `${id}${open}"${trimmed.replace(/"/g, "'")}"${close}`;
  };

  return chart
    .replace(/([A-Za-z0-9_]+)(\[)([^\]\n]+)(\])/g, (_m, id, o, l, c) => quote(id, o, l, c))
    .replace(/([A-Za-z0-9_]+)(\()([^)\n]+)(\))/g, (_m, id, o, l, c) => quote(id, o, l, c));
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureInitialized();

    async function attempt() {
      const candidates = [chart.trim(), autoQuoteMermaidLabels(chart.trim())];
      for (const [i, candidate] of candidates.entries()) {
        try {
          const result = await mermaid.render(`mermaid-${id}-${i}`, candidate);
          if (!cancelled) setSvg(result.svg);
          return;
        } catch {
          // try the next candidate
        }
      }
      if (!cancelled) setFailed(true);
    }

    attempt();
    return () => {
      cancelled = true;
    };
  }, [id, chart]);

  if (failed) {
    return (
      <div className="my-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3">
        <p className="text-xs text-zinc-500">
          This diagram couldn&apos;t be rendered.{" "}
          <button
            onClick={() => setShowSource((s) => !s)}
            className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {showSource ? "Hide" : "Show"} source
          </button>
        </p>
        {showSource && (
          <pre className="mt-2 text-xs overflow-x-auto text-zinc-600 dark:text-zinc-400">
            {chart}
          </pre>
        )}
      </div>
    );
  }

  if (!svg) {
    return <div className="text-xs text-zinc-400 py-2">Rendering diagram...</div>;
  }

  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
