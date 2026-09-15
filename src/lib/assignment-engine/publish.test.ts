import { describe, expect, it } from "vitest";

import { distributeAssignments } from "./distribution";
import { formatScheduleLabel } from "./recurrence";
import type { RecurrenceRule } from "./types";

describe("assignment engine", () => {
  it("distributes stores equally across auditors", () => {
    const result = distributeAssignments({
      storeIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
      assignees: [
        { user_id: "a1", name: "A1", role: "member", email: "", status: "active" },
        { user_id: "a2", name: "A2", role: "member", email: "", status: "active" },
        { user_id: "a3", name: "A3", role: "member", email: "", status: "active" },
      ],
      strategy: "equal",
    });
    expect(result).toHaveLength(3);
    expect(result.reduce((sum, r) => sum + r.storeCount, 0)).toBe(6);
  });

  it("formats weekly recurrence label", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      daysOfWeek: [1],
      startDate: "2026-09-15",
      startTime: "09:00",
      timezone: "Asia/Kolkata",
    };
    expect(formatScheduleLabel(rule)).toContain("Mon");
    expect(formatScheduleLabel(rule)).toContain("09:00");
  });
});
