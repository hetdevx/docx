export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  DOCX_MIME_TYPE,
  "text/plain",
  "text/html",
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}
