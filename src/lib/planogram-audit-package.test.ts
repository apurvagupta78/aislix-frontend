import { describe, expect, it } from "vitest";
import { autoPopulateAuditPackage } from "@/lib/planogram-audit-package";

describe("autoPopulateAuditPackage", () => {
  it("accepts a missing or partial package", () => {
    const rows = [{ sku: "A1", brand: "Colgate", product_name: "Total", mrp_inr: 99 }];
    const pkg = autoPopulateAuditPackage(rows, {});
    expect(pkg.assortment_skus.map((a) => a.sku)).toEqual(["A1"]);
    expect(pkg.msl_skus.map((a) => a.sku)).toEqual(["A1"]);
    expect(pkg.price_requirements).toHaveLength(1);
    expect(pkg.promotions).toEqual([]);
    expect(pkg.primary_brand).toBe("Colgate");
  });
});
