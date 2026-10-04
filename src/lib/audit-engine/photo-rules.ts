import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";

export type PhotoRules = {
  captureSource: AuditEvidencePolicy["captureSource"];
  /** 0 = no limit. */
  maxAgeMinutes: number;
  /** When the auditee first opened this audit (ISO). */
  openedAt: string | null;
};

export function photoRulesFromPolicy(
  policy: Partial<AuditEvidencePolicy> | null | undefined,
  openedAt: string | null,
): PhotoRules {
  return {
    captureSource: policy?.captureSource ?? "either",
    maxAgeMinutes: Math.max(0, Number(policy?.maximumEvidenceAgeMinutes) || 0),
    openedAt,
  };
}

/** EXIF "YYYY:MM:DD HH:MM:SS" is the camera's local time. */
function parseExifDate(text: string): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Capture time from JPEG EXIF (DateTimeOriginal, else DateTime); null when absent. */
export function readExifTakenAt(buffer: ArrayBuffer): Date | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xda || size < 2) return null;
    if (marker === 0xe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return readTiffDate(view, offset + 10, Math.min(view.byteLength, offset + 2 + size));
    }
    offset += 2 + size;
  }
  return null;
}

function readTiffDate(view: DataView, tiff: number, end: number): Date | null {
  if (tiff + 8 > end) return null;
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const ascii = (at: number, count: number) => {
    let s = "";
    for (let i = 0; i < count && at + i < end; i++) {
      const c = view.getUint8(at + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const scan = (ifd: number): Map<number, number> => {
    const tags = new Map<number, number>();
    if (ifd + 2 > end) return tags;
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (entry + 12 > end) break;
      tags.set(u16(entry), entry);
    }
    return tags;
  };
  const dateAt = (entry: number | undefined) => {
    if (entry === undefined) return null;
    const count = u32(entry + 4);
    const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    return parseExifDate(ascii(at, count));
  };
  const ifd0 = scan(tiff + u32(tiff + 4));
  const exifPointer = ifd0.get(0x8769);
  const exif = exifPointer !== undefined ? scan(tiff + u32(exifPointer + 8)) : new Map<number, number>();
  return dateAt(exif.get(0x9003)) ?? dateAt(ifd0.get(0x0132));
}

export async function photoTakenAt(file: File): Promise<Date | null> {
  try {
    const exif = readExifTakenAt(await file.slice(0, 256 * 1024).arrayBuffer());
    if (exif) return exif;
  } catch {
    /* fall back to the file date */
  }
  return file.lastModified ? new Date(file.lastModified) : null;
}

const minutesAgo = (from: Date, now: Date) => Math.max(0, (now.getTime() - from.getTime()) / 60_000);

function agoLabel(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)} minutes ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

/** Why this photo breaks the audit's photo rules, or null when it's allowed. */
export function photoTimingProblem(takenAt: Date | null, rules: PhotoRules, now = new Date()): string | null {
  if (rules.captureSource === "in_app_only") {
    if (!takenAt) return "We couldn't tell when this photo was taken. Take a new photo with the camera.";
    const opened = rules.openedAt ? new Date(rules.openedAt) : null;
    const startedBefore = opened && !Number.isNaN(opened.getTime()) ? opened.getTime() - 2 * 60_000 : now.getTime() - 10 * 60_000;
    if (takenAt.getTime() < startedBefore) {
      return "Take this photo with the camera now — photos from the gallery or taken before the audit started aren't accepted.";
    }
  }
  if (rules.maxAgeMinutes > 0 && takenAt) {
    const age = minutesAgo(takenAt, now);
    if (age > rules.maxAgeMinutes) {
      return `This photo was taken ${agoLabel(age)}. Photos must be taken within the last ${rules.maxAgeMinutes} minutes — take a new one.`;
    }
  }
  return null;
}

/** 64-bit difference hash (hex) for spotting near-identical photos. */
export async function perceptualHash(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    bitmap.close();
    const px = ctx.getImageData(0, 0, 9, 8).data;
    const gray = (x: number, y: number) => {
      const i = (y * 9 + x) * 4;
      return 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    };
    let bits = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray(x, y) > gray(x + 1, y) ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

export function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export const SIMILAR_PHOTO_DISTANCE = 5;
