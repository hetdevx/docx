import OpenAI from "openai";

const GROQ_MODEL = "openai/gpt-oss-120b";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export type LLMResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function errorMessage(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    return `${err.status ?? ""} ${err.message}`.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

async function callGroq(prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const res = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function callOpenRouter(prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const res = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}

/**
 * Tries Groq (with one retry), then falls back to OpenRouter. Returns the
 * *actual* failure reason on the way out — a 413 "request too large" and a
 * missing API key are very different problems for a caller to explain to
 * the user, so this doesn't collapse them into one generic message.
 */
export async function askLLM(prompt: string): Promise<LLMResult> {
  let groqError: string | null = null;

  if (process.env.GROQ_API_KEY) {
    try {
      return { ok: true, text: await callGroq(prompt) };
    } catch (err) {
      groqError = errorMessage(err);
      console.error("[llm] Groq failed, retrying once:", err);
      try {
        return { ok: true, text: await callGroq(prompt) };
      } catch (err2) {
        groqError = errorMessage(err2);
        console.error("[llm] Groq retry failed, falling back to OpenRouter:", err2);
      }
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return { ok: true, text: await callOpenRouter(prompt) };
    } catch (err) {
      console.error("[llm] OpenRouter failed:", err);
      const openRouterError = errorMessage(err);
      return {
        ok: false,
        error: groqError
          ? `Groq: ${groqError}; OpenRouter: ${openRouterError}`
          : `OpenRouter: ${openRouterError}`,
      };
    }
  }

  if (groqError) {
    return { ok: false, error: `Groq: ${groqError} (no OpenRouter key configured as fallback)` };
  }

  return { ok: false, error: "No GROQ_API_KEY or OPENROUTER_API_KEY configured" };
}
