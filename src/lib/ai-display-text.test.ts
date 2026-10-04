import { describe, expect, it } from "vitest";

import { hideModelNames } from "./ai-display-text";

describe("hideModelNames", () => {
  it("replaces model names in AI-written prose with AI", () => {
    expect(hideModelNames("Answered from Astra's counts. Luna does not recount.")).toBe(
      "Answered from AI counts. AI does not recount.",
    );
    expect(hideModelNames("GPT-6 Astra counted 12 units")).toBe("AI counted 12 units");
    expect(hideModelNames("model gpt-5.6-luna replied")).toBe("model AI replied");
    expect(hideModelNames("Astra and Luna agree")).toBe("AI agree");
  });

  it("keeps all-caps product names read from labels", () => {
    expect(hideModelNames("LUNA protein bar is missing")).toBe("LUNA protein bar is missing");
  });
});
