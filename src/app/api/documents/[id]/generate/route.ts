import { askLLM } from "@/lib/llm";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";
import { stripCodeFence, HTML_FORMATTING_GUIDE, HTML_NO_EMPTY_ELEMENTS_RULE } from "@/lib/ai-html";

const MAX_CONTEXT_CHARS = 4000;

function buildPrompt(instruction: string, contextHtml: string, aiBrief: string | null): string {
  const trimmedContext = contextHtml.trim();
  const contextSection = trimmedContext
    ? `\n\nThe document already contains this content (for context — write something that fits alongside it, don't repeat it):\n"""\n${trimmedContext.slice(-MAX_CONTEXT_CHARS)}\n"""`
    : "";
  const briefSection = aiBrief
    ? `\n\nThis document's original brief (what it was created to cover): ${aiBrief}\nStay consistent with this intent.`
    : "";

  return `You are writing content to insert into a document, per this instruction: ${instruction}${briefSection}${contextSection}

Format it using whichever of these tags fit the content: ${HTML_FORMATTING_GUIDE}. ${HTML_NO_EMPTY_ELEMENTS_RULE} Return ONLY the new HTML fragment to insert — no <html>/<head>/<body> tags, no markdown code fences, no commentary before or after.`;
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/generate">,
) {
  try {
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);
    const instruction = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const contextHtml = typeof body?.contextHtml === "string" ? body.contextHtml : "";

    if (!instruction) {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }

    const result = await askLLM(buildPrompt(instruction, contextHtml, doc.aiBrief));
    if (!result.ok) {
      return Response.json({ error: `AI generation failed — ${result.error}` }, { status: 503 });
    }

    return Response.json({ html: stripCodeFence(result.text) });
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
    console.error(err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
