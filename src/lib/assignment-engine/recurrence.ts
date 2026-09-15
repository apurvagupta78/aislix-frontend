import type { DueConfig, RecurrenceRule } from "./types";

/** Parse YYYY-MM-DD + HH:mm in a given IANA timezone into UTC Date. */
export function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  const localIso = `${date}T${time}:00`;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const target = new Date(localIso);
    const parts = formatter.formatToParts(target);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    const offset = asUtc - target.getTime();
    return new Date(new Date(localIso).getTime() - offset);
  } catch {
    return new Date(localIso);
  }
}

export function formatScheduleLabel(rule: RecurrenceRule): string {
  const time = rule.startTime;
  switch (rule.frequency) {
    case "daily":
      return rule.interval === 1
        ? `Every day at ${time}`
        : `Every ${rule.interval} days at ${time}`;
    case "weekdays":
      return `Every weekday at ${time}`;
    case "weekly": {
      const days = (rule.daysOfWeek ?? [1])
        .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
        .join(", ");
      return rule.interval === 1
        ? `Every ${days} at ${time}`
        : `Every ${rule.interval} weeks on ${days} at ${time}`;
    }
    case "monthly":
      return rule.interval === 1
        ? `Monthly on day ${rule.dayOfMonth ?? 1} at ${time}`
        : `Every ${rule.interval} months on day ${rule.dayOfMonth ?? 1} at ${time}`;
    default:
      return `Custom schedule at ${time} (${rule.timezone})`;
  }
}

export function computeNextOccurrence(rule: RecurrenceRule, from: Date = new Date()): Date {
  const base = new Date(from);
  const [hours, minutes] = rule.startTime.split(":").map(Number);

  if (rule.frequency === "daily") {
    const next = new Date(base);
    next.setDate(next.getDate() + rule.interval);
    next.setHours(hours, minutes, 0, 0);
    return zonedDateTimeToUtc(
      next.toISOString().slice(0, 10),
      rule.startTime,
      rule.timezone,
    );
  }

  if (rule.frequency === "weekdays") {
    const next = new Date(base);
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
    return zonedDateTimeToUtc(
      next.toISOString().slice(0, 10),
      rule.startTime,
      rule.timezone,
    );
  }

  if (rule.frequency === "weekly") {
    const targets = rule.daysOfWeek?.length ? rule.daysOfWeek : [1];
    const next = new Date(base);
    for (let i = 0; i < 366; i++) {
      next.setDate(next.getDate() + 1);
      if (targets.includes(next.getDay())) {
        return zonedDateTimeToUtc(
          next.toISOString().slice(0, 10),
          rule.startTime,
          rule.timezone,
        );
      }
    }
  }

  if (rule.frequency === "monthly") {
    const next = new Date(base);
    next.setMonth(next.getMonth() + rule.interval);
    next.setDate(Math.min(rule.dayOfMonth ?? 1, 28));
    return zonedDateTimeToUtc(
      next.toISOString().slice(0, 10),
      rule.startTime,
      rule.timezone,
    );
  }

  const fallback = new Date(base);
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
}

export function computeDueAt(
  publishAt: Date,
  dueConfig: DueConfig,
  timezone: string,
): string | null {
  if (dueConfig.dueDate && dueConfig.dueTime) {
    return zonedDateTimeToUtc(dueConfig.dueDate, dueConfig.dueTime, timezone).toISOString();
  }
  if (dueConfig.dueOffsetHours != null) {
    const due = new Date(publishAt);
    due.setHours(due.getHours() + dueConfig.dueOffsetHours);
    return due.toISOString();
  }
  return null;
}

export function isScheduleExpired(rule: RecurrenceRule, occurrenceCount: number): boolean {
  if (rule.maxOccurrences != null && occurrenceCount >= rule.maxOccurrences) return true;
  if (rule.endDate) {
    const end = new Date(`${rule.endDate}T23:59:59`);
    return new Date() > end;
  }
  return false;
}
