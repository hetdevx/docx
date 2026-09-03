const EMBEDDING_MODEL = "nomic-embed-text";

// nomic-embed-text requires a task instruction prefix to produce good
// retrieval embeddings — documents and queries are embedded into
// deliberately different regions of the space. Skipping this (as this app
// did until now) degrades relevance significantly: unrelated text can end
// up scoring as "similar" because nothing tells the model which side of a
// retrieval task each piece of text is on.
export type EmbedTaskType = "document" | "query";

function withPrefix(text: string, type: EmbedTaskType): string {
  const prefix = type === "document" ? "search_document: " : "search_query: ";
  return `${prefix}${text}`;
}

export async function embedText(text: string, type: EmbedTaskType): Promise<number[]> {
  const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: withPrefix(text, type) }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embeddings request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}
