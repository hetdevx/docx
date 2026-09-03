import mammoth from "mammoth";
import { convert } from "html-to-text";

// pdf-parse (via pdfjs-dist) references the browser-only DOMMatrix API at
// module-load time, which throws under Node's runtime ("DOMMatrix is not
// defined") even when only extracting plain text with no canvas rendering
// involved. A no-op stub is enough to satisfy that reference. Guarded so it
// only ever runs once, right before the first PDF is actually processed —
// `pdf-parse` itself is imported dynamically for the same reason: importing
// it eagerly at the top of this file would crash every call to
// `extractText`, for every mime type, not just PDFs.
function ensurePdfPolyfills() {
  const g = globalThis as unknown as { DOMMatrix?: unknown };
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {};
  }
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
      ensurePdfPolyfills();
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        // result.text joins pages with "-- N of M --" boilerplate markers;
        // join the real per-page text directly instead so extraction (and
        // therefore the search index) isn't polluted with separator noise.
        return result.pages.map((p) => p.text).join("\n\n");
      } finally {
        await parser.destroy();
      }
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "text/html":
      return convert(buffer.toString("utf-8"), { wordwrap: false });
    case "text/plain":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
  }
}
