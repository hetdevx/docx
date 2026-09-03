import { askLLM } from "@/lib/llm";
import { loadDocumentOrThrow } from "@/lib/documents";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/require-user";
import { splitIntoBlocks, groupBlocksIntoChunks } from "@/lib/html-blocks";
import { stripCodeFence, HTML_NO_EMPTY_ELEMENTS_RULE } from "@/lib/ai-html";

// Groq's free tier caps at 8000 tokens/minute for this model, shared across
// prompt + completion, across ALL requests in the rolling window — not per
// call. Keeping each chunk small (~6000 chars ≈ 1500 tokens in, similar out)
// leaves headroom, and chunks are sent one at a time (never in parallel) so
// they don't stack up within the same window.
const CHUNK_CHARS = 6000;
const RATE_LIMIT_RETRY_DELAYS_MS = [15000, 30000];

function buildPrompt(html: string, aiBrief: string | null): string {
  const contentRule = aiBrief
    ? `This document has a brief describing what it's meant to cover: "${aiBrief}"

Compare the section below against that brief. If it only partly covers the brief, or is thin/skeletal (e.g. just a heading, or a couple of sentences where the brief implies much more), EXPAND it — add the missing sections, details, and points the brief calls for. Don't invent facts, numbers, or specifics that aren't implied by either the brief or the existing content, but do flesh out structure and prose the brief clearly calls for. If the section already covers its part of the brief adequately, just polish it instead of padding it further.`
    : `Improve grammar, clarity, and flow while preserving meaning. Do not add new sections or invent content that isn't implied by the original — there's no brief for this document, so stick to polishing what's there.`;

  return `You are editing a section of a larger HTML document (it may start or end mid-thought — that's expected, don't try to "complete" it).

${contentRule}

Also improve the HTML formatting/structure wherever it would genuinely help readability. You may use: <h1>-<h3>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <u>, <s>, <mark>, <a>, <blockquote>, <pre><code>, <code> (inline), <hr>. Concretely, look for opportunities to:
- Promote a sentence that's clearly acting as a section title into the right <h1>/<h2>/<h3> level (matching the heading levels already used nearby), and demote heading-like text that's really just emphasis.
- Wrap source code, commands, config, file paths, or other verbatim/technical text in <pre><code>...</code></pre>; wrap short inline technical terms (a function name, flag, filename mentioned in prose) in inline <code>.
- Turn a run of comma/semicolon-separated items, a sequence of short parallel statements, or numbered steps into a <ul>/<ol> list when that's clearer than one paragraph.
- Use <blockquote> for quoted material, callouts, or important asides.
- Apply <strong> to key terms/decisions and <em> for emphasis where the original clearly intends it (don't bold everything).
- Insert a <hr> between clearly distinct topics that were run together with no visual break, only if the section actually contains more than one topic.
- Fix mismatched or inconsistent list/heading nesting.
- Keep normal prose as <p> — don't force structure onto plain sentences that don't need it, and don't undo formatting that's already correct.

${HTML_NO_EMPTY_ELEMENTS_RULE}

Return ONLY the revised HTML fragment — no explanation, no markdown code fences, no commentary before or after.

Section:
${html}`;
}

function isRateLimited(error: string): boolean {
  return /\b(413|429)\b/.test(error);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function enhanceChunk(html: string, aiBrief: string | null): Promise<string> {
  let lastError = "";

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt++) {
    const result = await askLLM(buildPrompt(html, aiBrief));
    if (result.ok) return stripCodeFence(result.text);

    lastError = result.error;
    if (!isRateLimited(lastError) || attempt === RATE_LIMIT_RETRY_DELAYS_MS.length) break;

    await delay(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
  }

  throw new Error(lastError);
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/documents/[id]/enhance">,
) {
  try {
    const { id } = await params;
    const { doc } = await loadDocumentOrThrow(id, "edit");

    const body = await request.json().catch(() => null);
    const html = typeof body?.html === "string" ? body.html : "";

    if (!html.trim()) {
      return Response.json({ error: "Nothing to enhance yet" }, { status: 400 });
    }

    const blocks = splitIntoBlocks(html);
    const chunks = groupBlocksIntoChunks(blocks, CHUNK_CHARS);

    if (chunks.length === 0) {
      return Response.json({ error: "Nothing to enhance yet" }, { status: 400 });
    }

    const enhanced: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        enhanced.push(await enhanceChunk(chunks[i], doc.aiBrief));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return Response.json(
          {
            error: `AI enhancement failed on section ${i + 1} of ${chunks.length} — ${reason}. Sections before this one were enhanced successfully but nothing has been applied yet (nothing is saved until you click Save anyway).`,
          },
          { status: 503 },
        );
      }
    }

    return Response.json({ html: enhanced.join("") });
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
    return Response.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
