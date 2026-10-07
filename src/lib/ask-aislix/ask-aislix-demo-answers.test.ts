import { describe, expect, it } from "vitest";

import { buildDemoAskResponse, matchDemoAskIntent } from "./ask-aislix-demo-answers";

describe("demo Ask Aislix intents", () => {
  it("answers Lays adjustments with a 6-month variance trend", () => {
    const q = "How many times lays were adjusted in last 6 months at Aislix Store";
    expect(matchDemoAskIntent(q)?.id).toBe("lays_adjustments");
    const r = buildDemoAskResponse(q);
    expect(r.visual.type).toBe("line");
    expect(r.visual.data).toHaveLength(6);
    expect(r.answer).toContain("adjusted 14 times");
    expect(r.answer).toContain("Aislix Store");
    expect(r.table.rows).toHaveLength(6);
  });

  it("answers stacking image requests with a stacking gallery, not generic evidence", () => {
    const q = "Give me the stacking images at Aislix Store";
    expect(matchDemoAskIntent(q)?.id).toBe("stacking");
    const r = buildDemoAskResponse(q);
    expect(r.visual.type).toBe("image_gallery");
    expect(r.visual.data).toHaveLength(6);
    expect(r.answer).toContain("Aislix Store");
    expect(r.evidence).toBeUndefined();
  });

  it("uses a named demo store when the question mentions one", () => {
    const r = buildDemoAskResponse("Show stacking photos at Whitefield");
    expect(r.answer).toContain("DailyBasket — Whitefield");
  });

  it("keeps existing intents unchanged", () => {
    expect(matchDemoAskIntent("Show me the latest audit evidence images")?.id).toBe("evidence");
    expect(matchDemoAskIntent("What was inventory variance over the last 30 days?")?.id).toBe("inventory_variance");
  });
});
