/** Files a user can attach to an Intelligence analysis. The server re-checks every file. */

export const INTELLIGENCE_ATTACHMENT_BUCKET = "intelligence-attachments";
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type AttachmentKind = "csv" | "xlsx" | "pdf" | "image";

export type IntelligenceAttachment = {
  path: string;
  name: string;
  kind: AttachmentKind;
  size: number;
};

export const ATTACHMENT_TYPES: Record<string, { kind: AttachmentKind; mime: string }> = {
  csv: { kind: "csv", mime: "text/csv" },
  xlsx: { kind: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { kind: "pdf", mime: "application/pdf" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  png: { kind: "image", mime: "image/png" },
  webp: { kind: "image", mime: "image/webp" },
};

export const ATTACHMENT_ACCEPT = ".csv,.xlsx,.pdf,.jpg,.jpeg,.png,.webp";

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  csv: "CSV",
  xlsx: "Excel",
  pdf: "PDF",
  image: "Image",
};

export function attachmentExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/** Quick browser-side check so users get instant feedback; not a security boundary. */
export function precheckAttachment(file: { name: string; size: number }): string | null {
  const ext = attachmentExtension(file.name);
  if (!ATTACHMENT_TYPES[ext]) return `${file.name}: only CSV, Excel (.xlsx), PDF, JPG, PNG and WEBP files are allowed.`;
  if (file.size <= 0) return `${file.name} is empty.`;
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is larger than 10 MB.`;
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isIntelligenceAttachment(value: unknown): value is IntelligenceAttachment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.path === "string" &&
    typeof v.name === "string" &&
    typeof v.size === "number" &&
    (v.kind === "csv" || v.kind === "xlsx" || v.kind === "pdf" || v.kind === "image")
  );
}
