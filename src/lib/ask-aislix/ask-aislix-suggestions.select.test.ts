import { describe, expect, it } from "vitest";

import { ASK_AISLIX_SUGGESTION_LIBRARY } from "./ask-aislix-suggestions.library";
import {
  getWiredSuggestionCount,
  resolveSuggestionText,
  selectAskAislixSuggestions,
} from "./ask-aislix-suggestions.select";

describe("selectAskAislixSuggestions", () => {
  it("returns 6–8 wired suggestions by default", () => {
    const selected = selectAskAislixSuggestions({ rotationSeed: 42 });
    expect(selected.length).toBeGreaterThanOrEqual(6);
    expect(selected.length).toBeLessThanOrEqual(8);
  });

  it("rotates suggestions when the seed changes", () => {
    const a = selectAskAislixSuggestions({ rotationSeed: 1 }).map((s) => s.id);
    const b = selectAskAislixSuggestions({ rotationSeed: 2 }).map((s) => s.id);
    expect(a).not.toEqual(b);
  });

  it("prioritizes role-specific examples for supermarket users", () => {
    const selected = selectAskAislixSuggestions({
      roleHint: "supermarket",
      rotationSeed: 99,
      count: 7,
    });
    const ids = new Set(selected.map((s) => s.id));
    const hasSupermarket = ASK_AISLIX_SUGGESTION_LIBRARY.some(
      (item) => ids.has(item.id) && item.roles.includes("supermarket"),
    );
    expect(hasSupermarket).toBe(true);
  });

  it("substitutes city placeholders when a city filter is active", () => {
    const cityItem = ASK_AISLIX_SUGGESTION_LIBRARY.find((item) =>
      item.text.includes("{{city}}"),
    );
    expect(cityItem).toBeDefined();
    expect(resolveSuggestionText(cityItem!, "Mumbai")).toContain("Mumbai");
    expect(resolveSuggestionText(cityItem!, "all")).toContain("my");
  });

  it("keeps only wired-tool suggestions in the library", () => {
    expect(getWiredSuggestionCount()).toBe(ASK_AISLIX_SUGGESTION_LIBRARY.length);
    expect(getWiredSuggestionCount()).toBeGreaterThanOrEqual(50);
  });

  it("filters suggestions to categories with available data", () => {
    const selected = selectAskAislixSuggestions({
      rotationSeed: 7,
      count: 7,
      dataAvailability: {
        hasAudits: true,
        hasFindings: true,
        hasActions: false,
        hasInventory: false,
        hasExpiry: false,
        hasEvidence: false,
        hasStores: true,
        hasTrends: true,
        hasRecurring: false,
        hasComparison: true,
      },
    });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((s) => s.category !== "actions")).toBe(true);
    expect(selected.every((s) => s.category !== "inventory")).toBe(true);
  });

  it("returns no chips when the workspace has no audit data", () => {
    const selected = selectAskAislixSuggestions({
      rotationSeed: 7,
      dataAvailability: {
        hasAudits: false,
        hasFindings: false,
        hasActions: false,
        hasInventory: false,
        hasExpiry: false,
        hasEvidence: false,
        hasStores: false,
        hasTrends: false,
        hasRecurring: false,
        hasComparison: false,
      },
    });
    expect(selected).toEqual([]);
  });
});
