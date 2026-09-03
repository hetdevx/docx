type NodeInfo = { node: Text; normalized: string; rawOffsetMap: number[]; start: number };

function normalizeNode(text: string): { normalized: string; rawOffsetMap: number[] } {
  let normalized = "";
  const rawOffsetMap: number[] = [];
  let lastWasSpace = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        normalized += " ";
        rawOffsetMap.push(i);
        lastWasSpace = true;
      }
    } else {
      normalized += ch;
      rawOffsetMap.push(i);
      lastWasSpace = false;
    }
  }

  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    rawOffsetMap.pop();
  }

  return { normalized, rawOffsetMap };
}

/**
 * Finds `needle` (whitespace-insensitive) within `container`'s rendered text
 * and returns a Range spanning the match, or null if not found. Needed
 * because the needle comes from a separately-extracted plain-text chunk
 * whose whitespace doesn't line up 1:1 with the live DOM's text nodes.
 */
export function findTextRange(container: HTMLElement, needle: string): Range | null {
  const normalizedNeedle = needle.replace(/\s+/g, " ").trim();
  if (!normalizedNeedle) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodeInfos: NodeInfo[] = [];
  let haystack = "";
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const { normalized, rawOffsetMap } = normalizeNode(textNode.data);
    if (!normalized) continue;
    if (haystack.length > 0) haystack += " ";
    nodeInfos.push({ node: textNode, normalized, rawOffsetMap, start: haystack.length });
    haystack += normalized;
  }

  const matchStart = haystack.indexOf(normalizedNeedle);
  if (matchStart === -1) return null;
  const matchEnd = matchStart + normalizedNeedle.length;

  const startInfo = nodeInfos.find(
    (n) => matchStart >= n.start && matchStart < n.start + n.normalized.length,
  );
  const endInfo = [...nodeInfos]
    .reverse()
    .find((n) => matchEnd > n.start && matchEnd <= n.start + n.normalized.length);

  if (!startInfo || !endInfo) return null;

  const startNormalizedOffset = matchStart - startInfo.start;
  const endNormalizedOffset = matchEnd - endInfo.start;
  const rawStart = startInfo.rawOffsetMap[startNormalizedOffset] ?? 0;
  const rawEnd = (endInfo.rawOffsetMap[endNormalizedOffset - 1] ?? endInfo.node.data.length - 1) + 1;

  const range = document.createRange();
  range.setStart(startInfo.node, rawStart);
  range.setEnd(endInfo.node, Math.min(rawEnd, endInfo.node.data.length));
  return range;
}

/** Scrolls to and selects the matching text, if found. Returns whether it matched. */
export function scrollToAndHighlight(container: HTMLElement, needle: string): boolean {
  const range = findTextRange(container, needle);
  if (!range) return false;

  const el =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  el?.scrollIntoView({ behavior: "smooth", block: "center" });

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}
