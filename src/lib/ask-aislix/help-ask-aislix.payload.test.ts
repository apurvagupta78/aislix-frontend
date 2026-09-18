import { describe, expect, it } from "vitest";

import { buildQuestionBuilderPayload } from "./help-ask-aislix.payload";
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
    from: "2026-08-19",
    to: "2026-09-18",
  },
};

describe("buildQuestionBuilderPayload", () => {
  it("maps all authorized locations scope for OpenAI", () => {
    const payload = buildQuestionBuilderPayload(baseIntent);
    expect(payload.location.scope).toBe("all_authorized_locations");
  });

  it("includes custom user request and filters", () => {
    const payload = buildQuestionBuilderPayload({
      ...baseIntent,
      locations: { scope: "specific", city: "Mumbai" },
      limit: 10,
      optional_filters: { brand: "Coca-Cola", category: "Beverages" },
      custom_user_request: "Show me where variance is highest.",
    });
    expect(payload.location.city).toBe("Mumbai");
    expect(payload.limit).toBe(10);
    expect(payload.filters?.brand).toBe("Coca-Cola");
    expect(payload.custom_user_request).toContain("variance");
  });
});
