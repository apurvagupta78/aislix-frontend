import { describe, expect, it } from "vitest";

import {
  computeDueAt,
  DueDateResolutionError,
  mergeDueConfig,
  resolveAssignmentDueAt,
  zonedDateTimeToUtc,
} from "./recurrence";

describe("zonedDateTimeToUtc", () => {
  it("converts 18:00 Asia/Kolkata to 12:30 UTC", () => {
    const result = zonedDateTimeToUtc("2026-09-17", "18:00", "Asia/Kolkata");
    expect(result.toISOString()).toBe("2026-09-17T12:30:00.000Z");
  });

  it("converts 14:00 America/New_York (EDT) to 18:00 UTC", () => {
    const result = zonedDateTimeToUtc("2026-09-17", "14:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-09-17T18:00:00.000Z");
  });
});

describe("resolveAssignmentDueAt", () => {
  it("stores Gate 4 due_at as 12:30 UTC for 18:00 IST", () => {
    const dueAt = resolveAssignmentDueAt({
      dueConfig: { dueDate: "2026-09-17", dueTime: "18:00" },
      timezone: "Asia/Kolkata",
    });
    expect(dueAt).toBe("2026-09-17T12:30:00.000Z");
  });
  it("returns ISO UTC when due date and time are set (never null)", () => {
    const dueConfig = { dueDate: "2026-09-17", dueTime: "18:00" };
    const publishAt = new Date("2026-09-16T08:00:00.000Z");
    const dueAt = resolveAssignmentDueAt({
      dueConfig,
      timezone: "Asia/Kolkata",
      publishAt,
    });

    expect(dueAt).not.toBeNull();
    expect(dueAt).toBe(computeDueAt(publishAt, dueConfig, "Asia/Kolkata"));
  });

  it("merges legacy datetime-local dueAt when dueConfig fields are empty", () => {
    const publishAt = new Date("2026-09-16T08:00:00.000Z");
    const dueAt = resolveAssignmentDueAt({
      dueConfig: {},
      legacyDueAt: "2026-09-17T18:00",
      timezone: "Asia/Kolkata",
      publishAt,
    });

    expect(dueAt).not.toBeNull();
    expect(dueAt).toBe(
      computeDueAt(
        publishAt,
        { dueDate: "2026-09-17", dueTime: "18:00" },
        "Asia/Kolkata",
      ),
    );
  });

  it("returns null when no due date is configured", () => {
    expect(
      resolveAssignmentDueAt({
        dueConfig: {},
        timezone: "Asia/Kolkata",
      }),
    ).toBeNull();
  });

  it("throws when due date is set without due time", () => {
    expect(() =>
      resolveAssignmentDueAt({
        dueConfig: { dueDate: "2026-09-17" },
        timezone: "Asia/Kolkata",
      }),
    ).toThrow(DueDateResolutionError);
  });

  it("throws when due time is set without due date", () => {
    expect(() =>
      resolveAssignmentDueAt({
        dueConfig: { dueTime: "18:00" },
        timezone: "Asia/Kolkata",
      }),
    ).toThrow(DueDateResolutionError);
  });
});

describe("mergeDueConfig", () => {
  it("prefers explicit dueConfig over legacy dueAt", () => {
    expect(
      mergeDueConfig({ dueDate: "2026-09-18", dueTime: "09:00" }, "2026-09-17T18:00"),
    ).toEqual({ dueDate: "2026-09-18", dueTime: "09:00" });
  });
});
