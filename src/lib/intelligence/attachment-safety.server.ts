/**
 * Server-side safety checks for Intelligence attachments. A file is accepted only when its real
 * signature matches an allowed type and it carries no active content (scripts, macros, embedded
 * files, auto-run actions). Spreadsheets are turned into plain text for the AI; CSV formula cells
 * are neutralised so a stored file can never run a formula when opened in Excel.
 */

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  attachmentExtension,
  type AttachmentKind,
} from "@/lib/intelligence/attachments";

export class AttachmentRejected extends Error {}

export type InspectedAttachment = {
  kind: AttachmentKind;
  mime: string;
  ext: string;
  bytes: Uint8Array;
  /** Spreadsheet contents as CSV text for the AI. */
  text?: string;
};

const MAX_SHEETS = 5;
const MAX_ROWS_PER_SHEET = 1000;
const MAX_TEXT_CHARS = 120_000;
const MAX_ZIP_UNCOMPRESSED = 60 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 3000;
const MAX_PDF_STREAMS = 400;
const MAX_PDF_INFLATED = 40 * 1024 * 1024;

const PDF_ACTIVE_CONTENT =
  /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA|ImportData|SubmitForm)(?![A-Za-z0-9])/;
const XLSX_BLOCKED_PARTS = [
  { needle: "vbaProject.bin", reason: "contains macros" },
  { needle: "xl/macrosheets/", reason: "contains macros" },
  { needle: "xl/activeX/", reason: "contains ActiveX controls" },
  { needle: "xl/embeddings/", reason: "contains embedded files" },
  { needle: "xl/externalLinks/", reason: "links to other workbooks" },
];

export function safeFileName(name: string): string {
  const ext = attachmentExtension(name);
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

/** PDF names may hide letters as #xx hex escapes (/J#61vaScript). */
function decodePdfNames(text: string): string {
  return text.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

async function inflate(data: Uint8Array, budget: number): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > budget) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  } catch {
    return null;
  }
}

async function checkPdf(bytes: Uint8Array): Promise<void> {
  const head = latin1(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) throw new AttachmentRejected("is not a real PDF file.");
  const raw = latin1(bytes);
  const text = decodePdfNames(raw);
  if (/\/Encrypt(?![A-Za-z0-9])/.test(text)) {
    throw new AttachmentRejected("is password-protected. Remove the password and attach it again.");
  }
  if (PDF_ACTIVE_CONTENT.test(text)) {
    throw new AttachmentRejected("contains scripts, embedded files or auto-run actions, so it was blocked.");
  }

  // Object streams can hide those keys inside compressed data; inflate and check them too.
  const streamRe = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  let streams = 0;
  let inflatedTotal = 0;
  while ((match = streamRe.exec(raw)) && streams < MAX_PDF_STREAMS) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, match.index - 400), match.index);
    streamRe.lastIndex = end + 9;
    if (!/\/FlateDecode/.test(dict) || /\/Subtype\s*\/Image/.test(dict)) continue;
    streams += 1;
    const out = await inflate(bytes.subarray(start, end), MAX_PDF_INFLATED - inflatedTotal);
    if (!out) continue;
    inflatedTotal += out.length;
    if (PDF_ACTIVE_CONTENT.test(decodePdfNames(latin1(out)))) {
      throw new AttachmentRejected("contains scripts, embedded files or auto-run actions, so it was blocked.");
    }
    if (inflatedTotal >= MAX_PDF_INFLATED) break;
  }
}

/** Reads the zip central directory: entry names and declared uncompressed sizes. */
function zipEntries(bytes: Uint8Array): { names: string[]; uncompressed: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66_000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new AttachmentRejected("is not a valid Excel file.");
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  if (count > MAX_ZIP_ENTRIES) throw new AttachmentRejected("has too many parts to be a normal Excel file.");
  const names: string[] = [];
  let uncompressed = 0;
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
      throw new AttachmentRejected("is not a valid Excel file.");
    }
    uncompressed += view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    names.push(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen)));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return { names, uncompressed };
}

function checkXlsx(bytes: Uint8Array): void {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw new AttachmentRejected("is not a real Excel (.xlsx) file.");
  const { names, uncompressed } = zipEntries(bytes);
  if (uncompressed > MAX_ZIP_UNCOMPRESSED) throw new AttachmentRejected("expands to an unsafe size, so it was blocked.");
  if (!names.includes("[Content_Types].xml") || !names.some((n) => n === "xl/workbook.xml")) {
    throw new AttachmentRejected("is not a real Excel (.xlsx) file.");
  }
  for (const part of XLSX_BLOCKED_PARTS) {
    if (names.some((n) => n.includes(part.needle))) throw new AttachmentRejected(`${part.reason}, so it was blocked.`);
  }
}

function checkImage(bytes: Uint8Array, ext: string): void {
  const ok =
    ext === "png"
      ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : ext === "webp"
        ? startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
        : startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (!ok) throw new AttachmentRejected("is not a real image of that type.");
}

function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  if (text.includes("\u0000")) throw new AttachmentRejected("is not a plain-text CSV file.");
  return text.replace(/^\uFEFF/, "");
}

/** A cell starting with = + - @ (or a tab/CR) would run as a formula in Excel. */
function neutraliseCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?%?$/.test(s.trim())) return `'${s}`;
  return s;
}

type Xlsx = typeof import("xlsx");

function sheetRows(XLSX: Xlsx, sheet: import("xlsx").WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
  return rows.map((r) => (Array.isArray(r) ? r.map(neutraliseCell) : []));
}

function rowsToCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
}

function spreadsheetText(XLSX: Xlsx, workbook: import("xlsx").WorkBook): string {
  const parts: string[] = [];
  let used = 0;
  for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = sheetRows(XLSX, sheet);
    const kept = rows.slice(0, MAX_ROWS_PER_SHEET);
    let csv = rowsToCsv(kept);
    if (used + csv.length > MAX_TEXT_CHARS) csv = csv.slice(0, Math.max(0, MAX_TEXT_CHARS - used));
    used += csv.length;
    const note = rows.length > kept.length ? ` (first ${kept.length} of ${rows.length} rows)` : "";
    parts.push(`Sheet "${sheetName}"${note}:\n${csv}`);
    if (used >= MAX_TEXT_CHARS) {
      parts.push("(Remaining content was cut to fit.)");
      break;
    }
  }
  if (workbook.SheetNames.length > MAX_SHEETS) parts.push(`(Only the first ${MAX_SHEETS} sheets were read.)`);
  return parts.join("\n\n");
}

export async function inspectAttachment(name: string, input: Uint8Array): Promise<InspectedAttachment> {
  const ext = attachmentExtension(name);
  const type = ATTACHMENT_TYPES[ext];
  if (!type) throw new AttachmentRejected("is not an allowed file type (CSV, Excel, PDF, JPG, PNG or WEBP).");
  if (!input.length) throw new AttachmentRejected("is empty.");
  if (input.length > ATTACHMENT_MAX_BYTES) throw new AttachmentRejected("is larger than 10 MB.");

  if (type.kind === "image") {
    checkImage(input, ext);
    return { kind: "image", mime: type.mime, ext, bytes: input };
  }
  if (type.kind === "pdf") {
    await checkPdf(input);
    return { kind: "pdf", mime: type.mime, ext, bytes: input };
  }

  const XLSX = await import("xlsx");
  if (type.kind === "xlsx") {
    checkXlsx(input);
    let workbook: import("xlsx").WorkBook;
    try {
      workbook = XLSX.read(input, { type: "array", cellFormula: false, cellHTML: false, bookVBA: false });
    } catch {
      throw new AttachmentRejected("could not be read as an Excel file.");
    }
    return { kind: "xlsx", mime: type.mime, ext, bytes: input, text: spreadsheetText(XLSX, workbook) };
  }

  const startsBinary =
    startsWith(input, [0x25, 0x50, 0x44, 0x46]) ||
    startsWith(input, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(input, [0x4d, 0x5a]) ||
    startsWith(input, [0x7f, 0x45, 0x4c, 0x46]);
  if (startsBinary) throw new AttachmentRejected("is not a plain-text CSV file.");
  const text = decodeText(input);
  let workbook: import("xlsx").WorkBook;
  try {
    workbook = XLSX.read(text, { type: "string", raw: true, cellFormula: false });
  } catch {
    throw new AttachmentRejected("could not be read as a CSV file.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  const rows = sheet ? sheetRows(XLSX, sheet) : [];
  if (!rows.length) throw new AttachmentRejected("has no rows.");
  const clean = new TextEncoder().encode(rowsToCsv(rows));
  return { kind: "csv", mime: type.mime, ext, bytes: clean, text: spreadsheetText(XLSX, workbook) };
}
