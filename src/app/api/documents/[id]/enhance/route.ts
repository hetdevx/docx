import { prisma } from "@/lib/prisma";
import { askLLM } from "@/lib/llm";
import { canEdit } from "@/lib/access";
import { requireUser, UnauthorizedError } from "@/lib/require-user";
import { splitIntoBlocks, groupBlocksIntoChunks } from "@/lib/html-blocks";

function stripCodeFence(text: string): string {
  const match = text.match(/```(?:html)?\s*([\s\S]*?)\s*```/);
  return (match ? match[1] : text).trim();
}

// Groq's free tier caps at 8000 tokens/minute for this model, shared across
// prompt + completion, across ALL requests in the rolling window — not per
// call. Keeping each chunk small (~6000 chars ≈ 1500 tokens in, similar out)
// leaves headroom, and chunks are sent one at a time (never in parallel) so
// they don't stack up within the same window.
const CHUNK_CHARS = 6000;
const RATE_LIMIT_RETRY_DELAYS_MS = [15000, 30000];

function buildPrompt(html: string): string {
  return `You are editing a section of a larger HTML document (it may start or end mid-thought — that's expected, don't try to "complete" it). Improve grammar, clarity, and flow while preserving meaning and existing HTML formatting (headings, lists, bold, links, etc. — keep the same tags where the structure still makes sense). Do not add new sections or invent content that isn't implied by the original. Return ONLY the revised HTML fragment — no explanation, no markdown code fences, no commentary before or after.

Section:
${html}`;
}

function isRateLimited(error: string): boolean {
  return /\b(413|429)\b/.test(error);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function enhanceChunk(html: string): Promise<string> {
  let lastError = "";

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt++) {
    const result = await askLLM(buildPrompt(html));
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
    const user = await requireUser();
    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { access: true },
    });

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (!canEdit(user, doc)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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
        enhanced.push(await enhanceChunk(chunks[i]));
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
    console.error(err);
    return Response.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
