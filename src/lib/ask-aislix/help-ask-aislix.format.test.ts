import { describe, expect, it } from "vitest";

import { formatHelpAskQuestion } from "./help-ask-aislix.format";
import type { HelpAskIntent } from "./help-ask-aislix.types";

const baseIntent: HelpAskIntent = {
  operating_role: "supermarket",
  operating_context: "I am working in a supermarket operation.",
  user_role: "Store Manager",
  user_context: "I am a Supermarket Store Manager.",
  topic: "inventory",
  topic_label: "Inventory",
  locations: { scope: "all_my_locations" },
  time_range: {
    preset: "30d",
    label: "Last 30 days",
    from: "2026-08-20",
    to: "2026-09-18",
  },
};

describe("formatHelpAskQuestion fallback", () => {
  it("includes user context and topic", () => {
    const q = formatHelpAskQuestion(baseIntent);
    expect(q).toContain("Supermarket Store Manager");
    expect(q.toLowerCase()).toContain("inventory");
    expect(q.toLowerCase()).toContain("last 30 days");
  });

  it("includes city and brand when provided", () => {
    const q = formatHelpAskQuestion({
      ...baseIntent,
      locations: { scope: "specific", city: "Mumbai" },
      optional_filters: { brand: "Coca-Cola" },
    });
    expect(q).toContain("Mumbai");
    expect(q).toContain("Coca-Cola");
  });

  it("prioritizes custom user request when provided", () => {
    const q = formatHelpAskQuestion({
      ...baseIntent,
      custom_user_request:
        "I want to know whether Coca-Cola is getting more shelf space than Pepsi in my stores.",
    });
    expect(q).toContain("Coca-Cola");
    expect(q).toContain("Pepsi");
  });
});
