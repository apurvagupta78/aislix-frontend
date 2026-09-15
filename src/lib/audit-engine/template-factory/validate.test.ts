import { describe, expect, it } from "vitest";

import {
  ACCEPTANCE_TEMPLATES,
  FLAGSHIP_TEMPLATE_KEYS,
  PRIORITY_TEMPLATE_KEYS,
  STARTER_TEMPLATE_LIBRARY,
} from "./index";

describe("System template library", () => {
  it("has unique keys across starter library", () => {
    const keys = STARTER_TEMPLATE_LIBRARY.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes all priority templates", () => {
    for (const key of PRIORITY_TEMPLATE_KEYS) {
      expect(STARTER_TEMPLATE_LIBRARY.some((t) => t.key === key)).toBe(true);
    }
  });

  it("flagship templates are executable TemplateDefinitions", () => {
    for (const spec of ACCEPTANCE_TEMPLATES) {
      const def = spec.build();
      expect(def.operatingModel).toBe(spec.operatingModel);
      expect(def.purpose).toBe(spec.purpose);
      expect(def.subjectType).toBe(spec.subjectType);
      expect(def.sections.length).toBeGreaterThan(0);
      expect(def.fields.length).toBeGreaterThan(0);
      expect(def.workflow).toBeTruthy();
      expect(def.findingTypes?.length).toBeGreaterThan(0);
      expect(def.rcaOptions?.length).toBeGreaterThan(0);
    }
  });

  it("matches five flagship keys", () => {
    expect(FLAGSHIP_TEMPLATE_KEYS).toEqual([
      "local_store_expiry",
      "supermarket_planogram_shelf",
      "dark_store_inventory_expiry",
      "warehouse_receiving_qc",
      "fmcg_outlet_retail_execution",
    ]);
  });

  it("each operating model has templates", () => {
    for (const model of [
      "local_store",
      "supermarket",
      "dark_store",
      "warehouse",
      "fmcg_distributor",
    ] as const) {
      expect(STARTER_TEMPLATE_LIBRARY.filter((t) => t.operatingModel === model).length).toBeGreaterThan(
        5,
      );
    }
  });
});
