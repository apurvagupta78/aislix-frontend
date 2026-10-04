import type { AiAnalysisCheck } from "@/lib/ai-audit/ai-analysis";
import { emptyReferenceMeta, emptyReferenceRow, type ReferenceDocumentState } from "@/lib/ai-audit/reference-document";
import { DEMO_ORAL_CARE_META, DEMO_ORAL_CARE_ROWS } from "@/lib/demo-oral-care-planogram";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";

export const DEMO_SAMPLE_CHECKS: AiAnalysisCheck[] = ["presence", "quantity", "price", "location"];
export const DEMO_SAMPLE_QUESTION = "Which items on my stock list are missing or short on the shelf?";

/** Fictional stock list for the homepage sample shelf, one line per SKU of the demo planogram. */
export function demoSampleDocument(): ReferenceDocumentState {
  const bySku = new Map<string, { brand: string; product: string; variant: string; qty: number; price: number | null; shelves: Set<string> }>();
  for (const row of DEMO_ORAL_CARE_ROWS) {
    const key = row.sku || `${row.brand}|${row.product_name}|${row.variant}`;
    const entry = bySku.get(key) ?? {
      brand: row.brand,
      product: row.product_name,
      variant: row.variant,
      qty: 0,
      price: row.mrp_inr ?? null,
      shelves: new Set<string>(),
    };
    entry.qty += row.expected_facings ?? row.expected_qty ?? 0;
    if (row.location) entry.shelves.add(row.location);
    bySku.set(key, entry);
  }
  const rows = [...bySku.values()].map((entry, index) => ({
    ...emptyReferenceRow(index + 1),
    brand: entry.brand,
    product: entry.product,
    pack_size: entry.variant,
    qty: entry.qty,
    unit: "pcs",
    price: entry.price,
    location: [...entry.shelves].join(" / "),
    raw_text: [
      entry.product.toLowerCase().startsWith(entry.brand.toLowerCase()) ? "" : entry.brand,
      entry.product,
      entry.variant,
    ]
      .filter(Boolean)
      .join(" "),
  }));
  return {
    meta: { ...emptyReferenceMeta("csv", "sample-stock-list.csv"), document_type: "stock_list" },
    rows,
    saved: true,
  };
}

/** Homepage sample: stock list + checks + question pre-filled; the shelf photo is the bundled sample. */
export function buildDemoSampleDocumentContext(auditRole: AuditRoleTab = "supermarket"): ScanContextState {
  return {
    focus: {},
    auditRole,
    planogramMeta: {
      ...EMPTY_PLANOGRAM_META,
      category: DEMO_ORAL_CARE_META.category,
      sub_category: DEMO_ORAL_CARE_META.sub_category,
    },
    planogramRows: [],
    auditPackage: { assortment_skus: [], msl_skus: [], price_requirements: [], promotions: [], scoring: {} },
    reference: demoSampleDocument(),
    aiAnalysis: { checks: [...DEMO_SAMPLE_CHECKS], question: DEMO_SAMPLE_QUESTION },
  };
}
