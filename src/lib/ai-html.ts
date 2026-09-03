export function stripCodeFence(text: string): string {
  const match = text.match(/```(?:html)?\s*([\s\S]*?)\s*```/);
  return (match ? match[1] : text).trim();
}

// The tag set the Tiptap editor actually renders/supports (see the
// extensions list in rich-text-editor.tsx) — AI-generated HTML is
// constrained to these so nothing comes back unstyled or gets silently
// stripped by the editor.
export const HTML_FORMATTING_GUIDE =
  "<h1>-<h3> for section structure, <p> for prose, <ul>/<ol>/<li> for lists or steps, <strong>/<em> for emphasis, <blockquote> for callouts, <pre><code> for any code/commands/config, inline <code> for technical terms, and <hr> between distinct topics";

// Models occasionally emit a blank <li></li> (or <p></p>) as a "spacer"
// between real items, apparently imitating a blank line in a loose markdown
// list — this renders as a stray empty bullet in the editor. Called out
// explicitly since it otherwise slips through even well-formed HTML.
export const HTML_NO_EMPTY_ELEMENTS_RULE =
  "Never output an empty element with no text content — no blank <li></li>, <p></p>, or a <ul>/<ol> containing empty items used as spacing. Every list item and paragraph must contain real content; use normal spacing between elements instead, not empty tags.";
