const VOID_TAGS = new Set(["img", "hr", "br", "input", "meta", "link"]);

/**
 * Splits a flat block-level HTML string (TipTap's output — sequential
 * <h1-6>/<p>/<ul>/<ol>/<blockquote>/<pre>/<hr>/<img>, no overlapping tags)
 * into an array of complete top-level elements, by tracking tag depth
 * rather than a single regex — handles arbitrary nesting inside each block
 * (e.g. <ul><li><p>...) correctly since it only cares about depth 0.
 */
export function splitIntoBlocks(html: string): string[] {
  const blocks: string[] = [];
  const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*?(\/)?>/g;
  let depth = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html))) {
    const isClosing = match[0].startsWith("</");
    const tagName = match[1].toLowerCase();
    const isSelfClosing = Boolean(match[2]) || VOID_TAGS.has(tagName);

    if (!isClosing && !isSelfClosing) depth++;
    else if (isClosing) depth--;

    if (depth === 0) {
      blocks.push(html.slice(lastIndex, tagRegex.lastIndex));
      lastIndex = tagRegex.lastIndex;
    }
  }

  if (lastIndex < html.length) {
    const rest = html.slice(lastIndex);
    if (rest.trim()) blocks.push(rest);
  }

  return blocks.filter((b) => b.trim());
}

/** Greedily groups blocks into chunks no larger than `maxChars`, without splitting a block. */
export function groupBlocksIntoChunks(blocks: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (current && current.length + block.length > maxChars) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
