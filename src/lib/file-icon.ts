import { FileText, FileType, File as FileIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function iconForTitle(title: string): LucideIcon {
  const ext = title.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FileType;
  if (ext === "docx" || ext === "doc") return FileText;
  return FileIcon;
}
