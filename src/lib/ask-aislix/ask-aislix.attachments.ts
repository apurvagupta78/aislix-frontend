import type { ResponseInputContent } from "openai/resources/responses/responses";

import type { AskAislixAttachmentInput } from "@/lib/ask-aislix/ask-aislix.types";

export const ASK_AISLIX_MAX_ATTACHMENTS = 5;
export const ASK_AISLIX_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".csv",
  ".json",
  ".md",
  ".xml",
  ".yaml",
  ".yml",
  ".log",
  ".tsv",
]);

const TEXT_MIME_PREFIXES = ["text/", "application/json", "application/xml"];

function isTextLikeAttachment(mimeType: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true;
  const ext = lower.slice(lower.lastIndexOf("."));
  return TEXT_EXTENSIONS.has(ext);
}

function decodeTextAttachment(attachment: AskAislixAttachmentInput): string | null {
  try {
    const decoded = Buffer.from(attachment.dataBase64, "base64").toString("utf8");
    if (!decoded.trim()) return null;
    return decoded.slice(0, 12000);
  } catch {
    return null;
  }
}

function buildFilePart(attachment: AskAislixAttachmentInput): ResponseInputContent {
  return {
    type: "input_file",
    filename: attachment.name,
    file_data: attachment.dataBase64,
  };
}

/** Convert validated user attachments into OpenAI Responses API input content parts. */
export function buildAttachmentContentParts(
  attachments: AskAislixAttachmentInput[],
): ResponseInputContent[] {
  const parts: ResponseInputContent[] = [];

  for (const attachment of attachments) {
    if (attachment.mimeType.startsWith("image/")) {
      parts.push({
        type: "input_image",
        detail: "auto",
        image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`,
      });
      continue;
    }

    if (isTextLikeAttachment(attachment.mimeType, attachment.name)) {
      const text = decodeTextAttachment(attachment);
      if (text) {
        parts.push({
          type: "input_text",
          text: `Attached file "${attachment.name}":\n${text}`,
        });
        continue;
      }
    }

    parts.push(buildFilePart(attachment));
  }

  return parts;
}
