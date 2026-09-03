import { askLLM } from "@/lib/llm";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";

const MAX_CONTEXT_CHARS = 600;

function buildPrompt(context: string): string {
  return `Continue the following text naturally, picking up exactly where it leaves off. Output ONLY the next few words — a short phrase or one short sentence, at most about 12 words. Do not repeat any of the given text, do not add quotes or explanation, do not restart the thought.

Text so far:
"""
${context}
"""`;
}

function cleanSuggestion(text: string, context: string): string {
  let suggestion = text.trim();
  // Models sometimes wrap the continuation in quotes despite instructions.
  suggestion = suggestion.replace(/^["'“‘]+|["'”’]+$/g, "");
  // Keep it short and single-line regardless of what came back.
  suggestion = suggestion.split("\n")[0].trim();

  if (!suggestion) return "";

  const needsLeadingSpace = context.length > 0 && !/\s$/.test(context) && !/^[\s.,!?;:]/.test(suggestion);
  return needsLeadingSpace ? ` ${suggestion}` : suggestion;
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/autocomplete">,
) {
  try {
    const { id } = await params;
    await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);
    const context = typeof body?.context === "string" ? body.context.slice(-MAX_CONTEXT_CHARS) : "";

    if (context.trim().length < 8) {
      return Response.json({ suggestion: "" });
    }

    // Best-effort: a failed or rate-limited autocomplete should never show
    // an error to the user — it should just stay silent, unlike Enhance or
    // Generate which the user explicitly triggered and is waiting on.
    const result = await askLLM(buildPrompt(context));
    if (!result.ok) {
      console.error("[autocomplete] LLM failed:", result.error);
      return Response.json({ suggestion: "" });
    }

    return Response.json({ suggestion: cleanSuggestion(result.text, context) });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof NotFoundError) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.json({ suggestion: "" });
  }
}
