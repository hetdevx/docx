import OpenAI from "openai";

// nvidia/llama-nemotron-embed-vl-1b-v2:free — chosen because it's OpenRouter's
// only free embedding model. It outputs 2048-dim vectors (see the
// switch_to_openrouter_embeddings migration for why that pushed the schema
// off pgvector's ivfflat 2000-dim index limit). Unlike nomic-embed-text (the
// previous, Ollama-hosted model), it has no documented query/document
// instruction-prefix convention, so `type` is accepted for interface
// stability with existing callers but no longer changes the request.
const EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free";

export type EmbedTaskType = "document" | "query";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function embedText(text: string, _type: EmbedTaskType): Promise<number[]> {
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    // The OpenAI SDK defaults to requesting base64-encoded embeddings;
    // this model 400s on that and only accepts floats.
    encoding_format: "float",
  });

  const embedding = res.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenRouter embeddings response contained no embedding");
  }
  return embedding;
}
