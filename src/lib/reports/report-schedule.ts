/**
 * Report schedules: when the next email goes out, in the scheduler's own time zone.
 */

import type { ReportDays, ReportKind } from "@/lib/reports/report-document";
import type { SegmentId } from "@/lib/segments/segment-config";

export type ScheduleFrequency = "daily" | "weekly";

/** Off until a timer calls /api/cron/report-schedules in production; otherwise schedules would never send. */
export const REPORT_SCHEDULES_LIVE = false;
export const DEFAULT_SCHEDULE_TIMEZONE = "Asia/Kolkata";
export const MAX_SCHEDULES_PER_PERSON = 20;
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ScheduleTiming = {
  frequency: ScheduleFrequency;
  /** 0 = Sunday. Required for weekly schedules. */
  weekday: number | null;
  sendHour: number;
  timeZone: string;
};

export type ReportScheduleRow = {
  id: string;
  kind: ReportKind;
  segment: SegmentId;
  store_id: string | null;
  days: ReportDays;
  preview_demo: boolean;
  frequency: ScheduleFrequency;
  weekday: number | null;
  send_hour: number;
  timezone: string;
  recipients: string[];
  enabled: boolean;
  next_run_at: string;
  last_sent_at: string | null;
  last_status: string | null;
};

export function safeTimeZone(timeZone: string | null | undefined): string {
  const tz = (timeZone ?? "").trim();
  if (!tz) return DEFAULT_SCHEDULE_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_SCHEDULE_TIMEZONE;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Local wall-clock minus UTC, in ms, at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedHourToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour);
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  const second = wall - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** The first send time strictly after `now`. */
export function nextScheduleRun(now: Date, timing: ScheduleTiming): Date {
  const timeZone = safeTimeZone(timing.timeZone);
  const hour = Math.min(23, Math.max(0, Math.trunc(timing.sendHour)));
  const today = zonedParts(now, timeZone);
  for (let offset = 0; offset <= 8; offset += 1) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (timing.frequency === "weekly" && day.getUTCDay() !== timing.weekday) continue;
    const at = zonedHourToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, timeZone);
    if (at.getTime() > now.getTime()) return at;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function hourLabel(hour: number): string {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

export function scheduleLabel(timing: Pick<ScheduleTiming, "frequency" | "weekday" | "sendHour">): string {
  const at = hourLabel(timing.sendHour);
  if (timing.frequency === "weekly" && timing.weekday != null) {
    return `Every ${WEEKDAY_LABELS[timing.weekday] ?? "week"} at ${at}`;
  }
  return `Every day at ${at}`;
}

/** Plain-language status for the last run, shown next to each schedule. */
export function scheduleStatusLabel(status: string | null): string | null {
  if (!status) return null;
  if (status === "sent") return "Last email sent";
  if (status === "no_store_access") return "Paused: no stores in your access";
  if (status === "left_workspace") return "Stopped: you left this workspace";
  if (status === "rate_limited") return "Skipped: daily email limit reached";
  if (status === "not_sent") return "Last email could not be delivered";
  return "Last run failed";
}
