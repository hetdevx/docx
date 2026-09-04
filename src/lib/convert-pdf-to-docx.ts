import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Converts a PDF buffer to DOCX bytes via headless LibreOffice. LibreOffice
 * only accepts file paths (no stdin/stdout), so this round-trips through a
 * scratch directory that's always cleaned up.
 */
export async function convertPdfToDocx(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "pdf-convert-"));
  try {
    const inputPath = join(dir, "input.pdf");
    await writeFile(inputPath, buffer);

    try {
      await execFileAsync(
        "soffice",
        [
          "--headless",
          "--norestore",
          // Isolated profile per call: LibreOffice locks a single shared
          // profile dir, so concurrent conversions (no queue in this app)
          // would otherwise collide/hang on each other.
          `-env:UserInstallation=file://${dir}/lo-profile`,
          // Without this, LibreOffice opens a PDF with its default import
          // filter, which loads it as a Draw (vector-graphics) document —
          // Draw can't export to DOCX, so the conversion silently fails to
          // write the output file. This forces the Writer-based text import
          // instead, which actually produces editable paragraphs.
          '--infilter=writer_pdf_import',
          "--convert-to",
          "docx:MS Word 2007 XML",
          "--outdir",
          dir,
          inputPath,
        ],
        { timeout: 60_000 },
      );
    } catch (err) {
      throw new Error(
        `PDF to DOCX conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return await readFile(join(dir, "input.docx"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
