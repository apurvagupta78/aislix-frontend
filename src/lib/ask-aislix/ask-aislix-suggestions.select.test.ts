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

  it("avoids duplicate categories in a single selection when possible", () => {
    const selected = selectAskAislixSuggestions({ rotationSeed: 123, count: 7 });
    const categories = selected.map((s) => s.category);
    expect(new Set(categories).size).toBeGreaterThanOrEqual(4);
  });
});
