import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";

/** Numbers the Aislix backend measures from the stored photo file. */
export type PhotoMetrics = {
  sha256: string;
  bytes: number;
  decodable: boolean;
  width: number | null;
  height: number | null;
  /** Camera capture time, local wall clock ("YYYY:MM:DD HH:MM:SS"). */
  exif_taken_at: string | null;
  /** UTC offset of the capture time ("+05:30"). */
  exif_offset: string | null;
  brightness: number | null;
  sharpness: number | null;
  /** 64-bit difference hash, 16 hex characters. */
  dhash: string | null;
};

export type ServerPhotoIssue = { code: string; message: string; blocking: boolean };

/**
 * The server repeats the phone's checks with a small margin, so a photo the phone accepted is
 * only refused here when it clearly breaks a rule (or the phone check was skipped).
 */
export const SERVER_PHOTO_LIMITS = {
  minBytes: 8_000,
  minWidth: 480,
  minHeight: 360,
  darkBelow: 30,
  glareAbove: 250,
  blurBelow: 31.5,
  ageSlackMinutes: 5,
  openedSlackMinutes: 5,
  clockAheadMinutes: 15,
};

export const SIMILAR_PHOTO_MAX_DISTANCE = 5;

function wallClockParts(text: string): number[] | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every(Number.isFinite) ? parts : null;
}

function zoneOffsetMinutes(instant: number, timeZone: string): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const get = (type: string) => Number(fmt.formatToParts(new Date(instant)).find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Number.isFinite(asUtc) ? Math.round((asUtc - instant) / 60_000) : null;
  } catch {
    return null;
  }
}

/** Capture time in UTC from the camera's local time plus its offset, else the device time zone. */
export function captureTimeUtc(wall: string | null, offset: string | null, timeZone: string | null): Date | null {
  if (!wall) return null;
  const p = wallClockParts(wall);
  if (!p) return null;
  const asUtc = Date.UTC(p[0]!, p[1]! - 1, p[2]!, p[3]!, p[4]!, p[5]!);
  const o = offset ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (o) {
    const minutes = (o[1] === "-" ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3]));
    return new Date(asUtc - minutes * 60_000);
  }
  if (!timeZone) return null;
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const zone = zoneOffsetMinutes(guess, timeZone);
    if (zone === null) return null;
    guess = asUtc - zone * 60_000;
  }
  return new Date(guess);
}

function minutesLabel(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)} minutes`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} hours`;
  return `${Math.round(minutes / 1440)} days`;
}

export type ServerPhotoInput = {
  policy: Partial<AuditEvidencePolicy> | null | undefined;
  /** null when the photo could not be measured (service unavailable). */
  metrics: PhotoMetrics | null;
  /** When the auditee opened the audit (server time). */
  openedAt: Date | null;
  /** When the photo reached Aislix storage (server time). */
  receivedAt: Date;
  /** Device time zone recorded with the audit, used when the photo has no UTC offset. */
  timeZone: string | null;
  /** An earlier upload of the identical file in this organisation. */
  duplicate: { sameAudit: boolean } | null;
  /** Earlier photos in this organisation that look almost the same. */
  similar: { count: number; sameAudit: boolean };
};

/** Why the server refuses or flags this photo under the audit's photo rules. */
export function evaluateServerPhoto(input: ServerPhotoInput): ServerPhotoIssue[] {
  const { metrics, policy } = input;
  if (!metrics) {
    return [{ code: "not_checked", message: "Couldn't be checked on the server — a reviewer should look at it.", blocking: false }];
  }
  const L = SERVER_PHOTO_LIMITS;
  const checks = new Set(policy?.qualityChecks ?? ["duplicate_hash"]);
  const issues: ServerPhotoIssue[] = [];
  const block = (code: string, message: string) => issues.push({ code, message, blocking: true });
  const flag = (code: string, message: string) => issues.push({ code, message, blocking: false });

  if (checks.has("blur") || checks.has("dark") || checks.has("glare")) {
    if (metrics.bytes < L.minBytes) block("too_small", "The image file is too small. Take a clearer photo.");
    else if (!metrics.decodable) flag("unreadable", "This photo's format couldn't be read on the server.");
    else {
      if ((metrics.width ?? 0) < L.minWidth || (metrics.height ?? 0) < L.minHeight) {
        block("low_resolution", `The photo is too small (${metrics.width}×${metrics.height}). Take a closer photo.`);
      }
      if (checks.has("dark") && metrics.brightness !== null && metrics.brightness < L.darkBelow) {
        block("dark", "The photo is too dark. Retake it with better lighting.");
      }
      if (checks.has("glare") && metrics.brightness !== null && metrics.brightness > L.glareAbove) {
        block("glare", "The photo is washed out by glare. Change the angle or lighting and retake it.");
      }
      if (checks.has("blur") && metrics.sharpness !== null && metrics.sharpness < L.blurBelow) {
        block("blurry", "The photo is blurry. Hold steady and retake it.");
      }
    }
  }

  const inAppOnly = policy?.captureSource === "in_app_only";
  const maxAge = Math.max(0, Number(policy?.maximumEvidenceAgeMinutes) || 0);
  if (inAppOnly || maxAge > 0) {
    const takenAt = captureTimeUtc(metrics.exif_taken_at, metrics.exif_offset, input.timeZone);
    if (!takenAt) {
      flag("no_capture_time", "The photo has no capture time, so when it was taken can't be confirmed.");
    } else {
      const ageMinutes = (input.receivedAt.getTime() - takenAt.getTime()) / 60_000;
      if (maxAge > 0 && ageMinutes > maxAge + L.ageSlackMinutes) {
        block("too_old", `The photo was taken ${minutesLabel(ageMinutes)} before it was uploaded. Photos must be under ${maxAge} minutes old.`);
      }
      if (inAppOnly && input.openedAt && takenAt.getTime() < input.openedAt.getTime() - L.openedSlackMinutes * 60_000) {
        block("before_audit", "The photo was taken before the audit was opened. Take a new photo now.");
      }
      if (-ageMinutes > L.clockAheadMinutes) {
        flag("clock_ahead", "The photo's capture time is later than when it was uploaded — the phone clock may be wrong.");
      }
    }
  }

  if (checks.has("duplicate_hash") && input.duplicate) {
    block(
      "duplicate",
      input.duplicate.sameAudit
        ? "This exact photo was already added to this audit."
        : "This exact photo was already used in another audit. Every photo must be new.",
    );
  } else if (checks.has("similarity_review") && input.similar.count > 0) {
    flag(
      "similar",
      input.similar.sameAudit
        ? "Looks almost the same as another photo in this audit."
        : "Looks almost the same as a photo from another audit.",
    );
  }
  return issues;
}
