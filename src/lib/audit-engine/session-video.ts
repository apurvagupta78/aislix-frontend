/**
 * Session video proof: videos recorded inside Aislix carry the date, time and GPS burned onto
 * every frame, plus this metadata (saved next to the video refs under `session_video_meta`).
 * Uploaded files are kept but marked as not recorded live.
 */

import type { StoreCheck } from "@/lib/audit-engine/grid-evidence";

export const SESSION_VIDEO_META_KEY = "session_video_meta";

/** Longest in-app recording; keeps the file under the 100 MB upload limit. */
export const LIVE_VIDEO_MAX_SECONDS = 8 * 60;
export const LIVE_VIDEO_BITS_PER_SECOND = 1_200_000;

export type VideoGpsPoint = { lat: number; lng: number; accuracyM: number | null; at: string };

export type SessionVideoMeta = {
  ref: string;
  live: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationS: number | null;
  timezone: string | null;
  gpsStart: VideoGpsPoint | null;
  gpsEnd: VideoGpsPoint | null;
  storeCheck: StoreCheck | null;
  storeDistanceM: number | null;
  /** When the file reached Aislix (uploads and live recordings). */
  receivedAt: string;
};

function point(value: unknown): VideoGpsPoint | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const accuracy = Number(v.accuracyM);
  return {
    lat,
    lng,
    accuracyM: v.accuracyM != null && Number.isFinite(accuracy) ? accuracy : null,
    at: typeof v.at === "string" ? v.at : "",
  };
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
const STORE_CHECKS = new Set(["at_store", "near_store", "outside", "store_location_missing"]);

/** Reads the saved list (JSON string or array); drops malformed entries. */
export function parseSessionVideoMeta(raw: unknown): SessionVideoMeta[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && typeof v.ref === "string")
    .map((v) => ({
      ref: String(v.ref),
      live: v.live === true,
      startedAt: text(v.startedAt),
      endedAt: text(v.endedAt),
      durationS: num(v.durationS),
      timezone: text(v.timezone),
      gpsStart: point(v.gpsStart),
      gpsEnd: point(v.gpsEnd),
      storeCheck: STORE_CHECKS.has(String(v.storeCheck)) ? (v.storeCheck as StoreCheck) : null,
      storeDistanceM: num(v.storeDistanceM),
      receivedAt: text(v.receivedAt) ?? "",
    }));
}

export function upsertSessionVideoMeta(list: SessionVideoMeta[], entry: SessionVideoMeta): SessionVideoMeta[] {
  return [...list.filter((m) => m.ref !== entry.ref), entry];
}

export function formatVideoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatGpsPoint(p: Pick<VideoGpsPoint, "lat" | "lng" | "accuracyM">): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${p.accuracyM != null ? ` ±${Math.round(p.accuracyM)} m` : ""}`;
}

/** Text stamped on each frame: brand + store, date/time with seconds and zone, GPS, elapsed. */
export function liveVideoOverlayLines(input: {
  now: Date;
  timezone: string | null;
  storeName: string | null;
  gps: Pick<VideoGpsPoint, "lat" | "lng" | "accuracyM"> | null;
  gpsStatus: "waiting" | "ok" | "unavailable";
  elapsedS: number | null;
}): string[] {
  const stamp = input.now.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  const gps = input.gps
    ? `GPS ${formatGpsPoint(input.gps)}`
    : input.gpsStatus === "waiting"
      ? "GPS: finding location…"
      : "GPS unavailable";
  return [
    `Aislix live audit${input.storeName ? ` · ${input.storeName}` : ""}${input.elapsedS != null ? ` · REC ${formatVideoDuration(input.elapsedS)}` : ""}`,
    `${stamp}${input.timezone ? ` · ${input.timezone}` : ""}`,
    gps,
  ];
}

/** First MediaRecorder type this browser supports (MP4 on Safari, WebM elsewhere). */
export function pickRecorderMimeType(isSupported: (type: string) => boolean): string | null {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => isSupported(t)) ?? null;
}
