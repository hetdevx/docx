import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/embeddings";
import { askLLM } from "@/lib/llm";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

type ChunkResult = {
  chunk_id: string;
  chunk_text: string;
  doc_id: string;
  title: string;
  distance: number;
};

// Cosine distance (0 = identical, 1 = unrelated, 2 = opposite). Chunks past
// this are weak matches — better to return fewer, relevant results than pad
// up to the limit with noise just because nothing better exists yet.
const MAX_RELEVANT_DISTANCE = 0.4;
const MAX_RESULTS = 6;

/**
 * Extracts a window of `length` chars centered on the first matching
 * keyword's position in `text`, falling back to the start of the text when
 * no keyword is found there (a pure semantic match has no single "point" to
 * center on). Used for both the excerpt shown on the source card and the
 * snippet used to scroll/highlight the exact spot in the document viewer —
 * without this, both silently showed/pointed at the chunk's start regardless
 * of where the actual match was.
 */
function windowAroundMatch(
  text: string,
  keywords: string[],
  length: number,
): { text: string; truncatedStart: boolean } {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  let matchIndex = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) matchIndex = idx;
  }

  if (matchIndex === -1) return { text: normalized.slice(0, length), truncatedStart: false };

  const start = Math.max(0, matchIndex - Math.floor(length / 4));
  return { text: normalized.slice(start, start + length), truncatedStart: start > 0 };
}

const STOPWORDS = new Set([
  "what", "when", "where", "which", "does", "have", "with", "this", "that",
  "from", "your", "about", "them", "their", "there", "would", "could",
  "should", "please", "tell", "show", "give", "explain", "describe", "into",
  "over", "under", "after", "before", "will", "shall", "each", "every",
]);

// Names, IDs, and specific terms often don't embed close to anything even
// when the question is literally answerable by them (a signature name in a
// legal boilerplate paragraph has little semantic pull) — pure vector search
// misses these. Extract significant keywords and look for literal matches
// too, so exact lookups aren't silently dropped just because the surrounding
// context doesn't score well semantically.
function extractKeywords(question: string): string[] {
  const words = question
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));
  return [...new Set(words)];
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const plain = searchParams.get("mode") === "plain";

    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }

    const embedding = await embedText(question, "query");
    const vectorLiteral = `[${embedding.join(",")}]`;

    const accessFilter =
      user.orgRole === "admin"
        ? Prisma.sql`TRUE`
        : Prisma.sql`(
            d.owner_email = ${user.email}
            OR d.is_public = TRUE
            OR EXISTS (
              SELECT 1 FROM document_access da
              WHERE da.doc_id = d.id AND da.user_email = ${user.email}
            )
          )`;

    // Cosine distance (<=>) to match the ivfflat vector_cosine_ops index —
    // using <-> (L2) here would silently skip the index. Fetch more than we
    // need so the relevance filter below has real candidates to choose from.
    const candidates = await prisma.$queryRaw<ChunkResult[]>(Prisma.sql`
      SELECT dc.id AS chunk_id, dc.chunk_text, d.id AS doc_id, d.title,
             dc.embedding <=> ${vectorLiteral}::vector AS distance
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.doc_id
      WHERE d.status = 'ready' AND ${accessFilter}
      ORDER BY distance ASC
      LIMIT 20
    `);

    const keywords = extractKeywords(question);
    let keywordCandidates: ChunkResult[] = [];
    if (keywords.length > 0) {
      const likeConditions = Prisma.join(
        keywords.map((w) => Prisma.sql`dc.chunk_text ILIKE ${"%" + w + "%"}`),
        " OR ",
      );
      keywordCandidates = await prisma.$queryRaw<ChunkResult[]>(Prisma.sql`
        SELECT dc.id AS chunk_id, dc.chunk_text, d.id AS doc_id, d.title, 0::float AS distance
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.doc_id
        WHERE d.status = 'ready' AND ${accessFilter} AND (${likeConditions})
        LIMIT 10
      `);
    }

    const semanticMatches = candidates.filter((r) => r.distance <= MAX_RELEVANT_DISTANCE);
    const seen = new Set<string>();
    const results: ChunkResult[] = [];
    for (const r of [...keywordCandidates, ...semanticMatches]) {
      if (seen.has(r.chunk_id)) continue;
      seen.add(r.chunk_id);
      results.push(r);
      if (results.length >= MAX_RESULTS) break;
    }

    const sources = results.map((r) => {
      const excerptWindow = windowAroundMatch(r.chunk_text, keywords, 300);
      const snippetWindow = windowAroundMatch(r.chunk_text, keywords, 80);
      return {
        documentId: r.doc_id,
        title: r.title,
        excerpt: excerptWindow.truncatedStart ? `…${excerptWindow.text}` : excerptWindow.text,
        // Raw (no ellipsis) — must be an exact literal substring of the
        // rendered document for the "View in document" jump-to-highlight
        // to find it.
        snippet: snippetWindow.text,
      };
    });

    if (plain || results.length === 0) {
      return Response.json({ mode: "plain", answer: null, sources });
    }

    const context = results
      .map((r, i) => `[${i + 1}] (${r.title})\n${r.chunk_text}`)
      .join("\n\n");

    const prompt = `Answer the question using only the excerpts below. Cite which document each fact comes from using a plain bracketed number matching the excerpt, e.g. "[1]" — use ASCII brackets only, never full-width or other Unicode bracket characters.

Format the answer in clean markdown, well-suited to the content:
- Use "## "/"### " headings to break up distinct sections of a longer answer.
- Use "-" or "1." lists for enumerations, steps, or action items — never comma-separated run-on lists.
- Use **bold** for key terms or decisions, and a "> " blockquote for a directly quoted line.
- For code, commands, config, or file contents, use a fenced code block with the right language tag.
- Do NOT use markdown tables (they don't render here) — turn tabular/structured data (e.g. a set of fields like date, participants, status) into a short bullet list instead, one "- **Field:** value" per line.
- Do NOT use raw HTML tags like <br> — use a blank line to start a new paragraph.
- Separate genuinely distinct topics with a horizontal rule ("---") only if the answer covers more than one.

Only include a Mermaid diagram (fenced code block tagged "mermaid") when the excerpts are specifically about software/technical topics — code architecture, a deployment or CI/CD pipeline, a system or data flow, an API sequence, infrastructure layout. Do NOT add a diagram for meetings, plans, agendas, business processes, or any other non-technical content, even if it describes a sequence of steps — a bullet/numbered list is the right format for those. When a diagram IS warranted, follow these strict Mermaid syntax rules (violating these breaks rendering entirely):
- Wrap every node's label text in double quotes, always, with no exceptions: \`A["Step one"]\`, not \`A[Step one]\`.
- This is required even for short labels with no punctuation — quote all of them, every time.
- Never put a raw \`(\`, \`)\`, \`:\`, \`&\`, \`#\`, \`{\`, or \`}\` character inside a label unless the whole label is quoted (which it always should be per the rule above).
- Keep it to flowchart (\`flowchart LR\` or \`flowchart TD\`) or sequenceDiagram syntax — nothing more exotic.

Correct example (only for technical content):
\`\`\`mermaid
flowchart LR
    A["Push code to main branch"] --> B["CI runs automated tests"]
    B --> C["Build Docker image (if tests pass)"]
    C --> D["Deploy to production"]
\`\`\`

If the excerpts don't contain the answer, say so.\n\nExcerpts:\n${context}\n\nQuestion: ${question}`;

    const result = await askLLM(prompt);
    if (!result.ok) console.error("[search] LLM failed:", result.error);

    return Response.json({
      mode: "ai",
      answer: result.ok ? result.text : null,
      answerUnavailable: !result.ok,
      sources,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
