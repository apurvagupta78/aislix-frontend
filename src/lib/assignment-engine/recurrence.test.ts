import { describe, expect, it } from "vitest";

import {
  computeDueAt,
  DueDateResolutionError,
  mergeDueConfig,
  resolveAssignmentDueAt,
} from "./recurrence";

describe("resolveAssignmentDueAt", () => {
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
