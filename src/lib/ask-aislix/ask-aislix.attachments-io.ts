import type { AskAislixAttachmentInput } from "@/lib/ask-aislix/ask-aislix.types";
import {
  ASK_AISLIX_MAX_ATTACHMENT_BYTES,
  ASK_AISLIX_MAX_ATTACHMENTS,
} from "@/lib/ask-aislix/ask-aislix.attachments";

export async function readAskAislixAttachment(file: File): Promise<AskAislixAttachmentInput> {
  if (file.size > ASK_AISLIX_MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is too large. Maximum size is 10 MB per file.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });

  const comma = dataUrl.indexOf(",");
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    dataBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    size: file.size,
  };
}

export async function readAskAislixAttachments(
  files: FileList | File[],
  existingCount: number,
): Promise<AskAislixAttachmentInput[]> {
  const list = Array.from(files);
  if (existingCount + list.length > ASK_AISLIX_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${ASK_AISLIX_MAX_ATTACHMENTS} files per question.`);
  }

  return Promise.all(list.map((file) => readAskAislixAttachment(file)));
}
