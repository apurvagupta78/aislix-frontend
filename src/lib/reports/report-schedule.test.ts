import { describe, expect, it } from "vitest";

import { hourLabel, nextScheduleRun, safeTimeZone, scheduleLabel } from "@/lib/reports/report-schedule";

const IST = "Asia/Kolkata";

describe("nextScheduleRun", () => {
  it("sends daily reports later today when the hour has not passed", () => {
    const now = new Date("2026-10-07T02:00:00Z"); // 07:30 IST
    const next = nextScheduleRun(now, { frequency: "daily", weekday: null, sendHour: 9, timeZone: IST });
    expect(next.toISOString()).toBe("2026-10-07T03:30:00.000Z");
  });

  it("rolls daily reports to tomorrow once the hour has passed", () => {
    const now = new Date("2026-10-07T10:00:00Z"); // 15:30 IST
    const next = nextScheduleRun(now, { frequency: "daily", weekday: null, sendHour: 9, timeZone: IST });
    expect(next.toISOString()).toBe("2026-10-08T03:30:00.000Z");
  });

  it("picks the next matching weekday for weekly reports", () => {
    const now = new Date("2026-10-07T10:00:00Z"); // Wednesday
    const next = nextScheduleRun(now, { frequency: "weekly", weekday: 1, sendHour: 9, timeZone: IST });
    expect(next.toISOString()).toBe("2026-10-12T03:30:00.000Z");
  });

  it("never returns the current send time, so a run moves a full week ahead", () => {
    const now = new Date("2026-10-07T03:30:00Z"); // Wednesday 09:00 IST
    const next = nextScheduleRun(now, { frequency: "weekly", weekday: 3, sendHour: 9, timeZone: IST });
    expect(next.toISOString()).toBe("2026-10-14T03:30:00.000Z");
  });

  it("keeps the local hour across a daylight-saving change", () => {
    const now = new Date("2026-10-31T15:00:00Z"); // Saturday, New York still on EDT
    const next = nextScheduleRun(now, {
      frequency: "weekly",
      weekday: 0,
      sendHour: 9,
      timeZone: "America/New_York",
    });
    expect(next.toISOString()).toBe("2026-11-01T14:00:00.000Z"); // 09:00 EST
  });

  it("falls back to India time for an unknown time zone", () => {
    expect(safeTimeZone("Not/AZone")).toBe(IST);
    const now = new Date("2026-10-07T02:00:00Z");
    const next = nextScheduleRun(now, { frequency: "daily", weekday: null, sendHour: 9, timeZone: "Not/AZone" });
    expect(next.toISOString()).toBe("2026-10-07T03:30:00.000Z");
  });
});

describe("schedule labels", () => {
  it("reads naturally", () => {
    expect(hourLabel(0)).toBe("12:00 am");
    expect(hourLabel(13)).toBe("1:00 pm");
    expect(scheduleLabel({ frequency: "daily", weekday: null, sendHour: 9 })).toBe("Every day at 9:00 am");
    expect(scheduleLabel({ frequency: "weekly", weekday: 1, sendHour: 18 })).toBe("Every Monday at 6:00 pm");
  });
});
