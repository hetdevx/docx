import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { convert } from "html-to-text";

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
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
