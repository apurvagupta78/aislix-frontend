/**
 * Recommended actions — display helpers (grouping/presentation only; no detection changes).
 */

import { demoPromotionalCompliance, isDemoOralCareResult } from "@/lib/demo-oral-care-planogram";
import { buildPositionComparisons } from "@/lib/planogram-comparison-display";
import { formatObservedShelfLabel } from "@/lib/observed-products-display";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import type { ScanRecommendation, ScanResult } from "@/lib/scan-results";
import { priorityRecommendations } from "@/lib/scan-execution";

export type ActionPriority = "high" | "medium" | "low";

export type RecommendedActionCard = {
  id: string;
  title: string;
  priority: ActionPriority;
  issue_type: string;
  explanation: string;
  expected_result?: string;
  observed_result?: string;
  expected_value?: string;
  observed_value?: string;
  shelf?: string;
  location?: string;
  recommended_action: string;
  review_status: string;
  evidence_target: string;
  evidence_label: "View Evidence" | "Review Evidence";
  is_review: boolean;
  sort_rank: number;
  source_ids: string[];
  sku?: string;
  brand?: string;
  product_name?: string;
  confidence?: string;
  coverage?: string;
};

export type PrioritySummary = {
  high: number;
  medium: number;
  low: number;
};

export type IssueTypeCount = {
  issue_type: string;
  count: number;
  bar_class: string;
};

const ISSUE_BAR = [
  "bg-brand",
  "bg-brand/70",
  "bg-brand/55",
  "bg-brand/40",
  "bg-brand/30",
] as const;

type RawAction = {
  id: string;
  title: string;
  detail: string;
  category: string;
  priority: ActionPriority;
  product_name: string;
  brand: string;
  issue_group: string;
  issue_type: string;
  expected_value?: string;
  observed_value?: string;
  shelf?: string;
  location?: string;
  is_review: boolean;
  sort_rank: number;
  evidence_target: string;
  sku?: string;
};

function normPriority(impact?: string): ActionPriority {
  if (impact === "high") return "high";
  if (impact === "low") return "low";
  return "medium";
}

function extractProductName(title: string): string {
  const patterns: RegExp[] = [
    /^Missing planogram SKU:\s*(.+)$/i,
    /^Wrong product on shelf:\s*expected\s*(.+)$/i,
    /^Short on\s*(.+)$/i,
    /^(.+?)\s*[—–-]\s*promotional price mismatch/i,
    /^(.+?)\s*[—–-]\s*price mismatch/i,
  ];
  for (const re of patterns) {
    const m = title.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function splitBrandProduct(label: string): { brand: string; product_name: string } {
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 1) return { brand: label.trim(), product_name: label.trim() };
  return { brand: parts[0]!, product_name: parts.slice(1).join(" ") };
}

function parseExpectedObserved(detail: string): {
  expected_value?: string;
  observed_value?: string;
  shelf?: string;
  location?: string;
} {
  const out: ReturnType<typeof parseExpectedObserved> = {};
  const priceMatch = detail.match(
    /expected\s*\$?([\d.]+)[^—–-]*[—–-]\s*observed\s*\$?([\d.]+)/i,
  );
  if (priceMatch) {
    out.expected_value = `$${priceMatch[1]}`;
    out.observed_value = `$${priceMatch[2]}`;
  }
  const shelfMatch = detail.match(/expected\s*(Shelf\s*\d+|S\d+[^,]*)/i);
  const foundMatch = detail.match(/(?:observed on|found on|found)\s*(Shelf\s*\d+|S\d+[^,.]*)/i);
  if (shelfMatch) out.expected_value = out.expected_value ?? shelfMatch[1];
  if (foundMatch) out.observed_value = out.observed_value ?? foundMatch[1];
  const loc = detail.match(/\b(S\d+-P\d+)\b/i);
  if (loc) out.location = loc[1];
  const shelfFromBlock = detail.match(/\bon\s+(S\d+[^.]*)/i);
  if (shelfFromBlock) out.shelf = formatObservedShelfLabel(shelfFromBlock[1]);
  if (shelfMatch && !out.shelf) out.shelf = formatObservedShelfLabel(shelfMatch[1]);
  return out;
}

function issueGroup(category: string, title: string, detail: string): string {
  const blob = `${category} ${title} ${detail}`.toLowerCase();
  if (blob.includes("promo") || blob.includes("price")) return "price_promotion";
  if (blob.includes("wrong") || blob.includes("misplaced") || blob.includes("placement"))
    return "placement";
  if (
    blob.includes("missing") ||
    blob.includes("absence") ||
    blob.includes("not detected") ||
    blob.includes("not clearly visible") ||
    blob.includes("replenish") ||
    blob.includes("restock") ||
    blob.includes("oos")
  )
    return "availability";
  if (blob.includes("short") || blob.includes("facings") || blob.includes("qty")) return "facings";
  if (blob.includes("planogram compliance") || blob.includes("restore planogram"))
    return "planogram_compliance";
  if (blob.includes("competitor") || blob.includes("shelf share")) return "competitive";
  return category.toLowerCase() || "general";
}

function evidenceTarget(issueGroup: string): string {
  switch (issueGroup) {
    case "price_promotion":
      return "kpi-evidence-promotional_compliance";
    case "placement":
    case "facings":
    case "planogram_compliance":
      return "audit-section-planogram";
    case "availability":
      return "kpi-evidence-osa";
    case "competitive":
      return "kpi-evidence-share_of_shelf";
    default:
      return "kpi-evidence-planogram_compliance";
  }
}

function sanitizeReplenishmentLanguage(title: string, detail: string): {
  title: string;
  is_review: boolean;
} {
  const blob = `${title} ${detail}`.toLowerCase();
  const uncertain =
    blob.includes("not clearly") ||
    blob.includes("verify") ||
    blob.includes("before replenishment") ||
    blob.includes("not detected with adequate") ||
    blob.includes("review before");
  if (/replenish|restock/i.test(title)) {
    const countMatch = title.match(/(\d+)/);
    const count = countMatch?.[1] ?? "";
    return {
      title: count
        ? `Review ${count} expected product absence${count === "1" ? "" : "s"}`
        : "Review expected product absences",
      is_review: true,
    };
  }
  if (/verified shelf absence/i.test(title)) {
    return { title: title.replace(/verified shelf absence/i, "expected product absence"), is_review: true };
  }
  return { title, is_review: uncertain };
}

function actionTitle(
  group: string,
  product: string,
  items: RawAction[],
): string {
  const review = items.some((i) => i.is_review);
  switch (group) {
    case "price_promotion":
      return product ? `Fix ${product} price & promotion` : "Fix price & promotion mismatch";
    case "placement":
      return product ? `Move ${product}` : "Correct shelf placement";
    case "availability":
      if (review) {
        const countMatch = items[0]?.title.match(/(\d+)/);
        const n = countMatch?.[1];
        return n ? `Review ${n} expected product absences` : "Review expected product absences";
      }
      return product ? `Check ${product} availability` : "Check shelf availability";
    case "facings":
      return product ? `Correct ${product} facings` : "Correct facing count";
    case "planogram_compliance":
      return "Restore planogram compliance";
    case "competitive":
      return items[0]?.title ?? "Review competitive shelf position";
    default:
      return items[0]?.title ?? "Review shelf issue";
  }
}

function issueTypeLabel(group: string): string {
  const labels: Record<string, string> = {
    price_promotion: "Price & promotion mismatch",
    placement: "Wrong shelf position",
    availability: "Product not clearly visible",
    facings: "Facing count deviation",
    planogram_compliance: "Planogram compliance",
    competitive: "Competitive shelf share",
    general: "Shelf issue",
  };
  return labels[group] ?? group.replace(/_/g, " ");
}

function recommendedActionText(group: string, review: boolean): string {
  if (review) {
    return "Verify identity and shelf coverage before replenishment.";
  }
  switch (group) {
    case "price_promotion":
      return "Update shelf price tag to match the configured promotion.";
    case "placement":
      return "Move the product to the expected shelf position and re-audit.";
    case "facings":
      return "Adjust facings to match the planogram and re-audit.";
    case "planogram_compliance":
      return "Review expected vs actual layout and correct placement.";
    default:
      return "Address the issue and re-audit to verify.";
  }
}

function rawFromRecommendation(rec: ScanRecommendation): RawAction {
  const parsed = parseExpectedObserved(rec.detail ?? "");
  const productLabel = extractProductName(rec.title) || rec.title;
  const { brand, product_name } = splitBrandProduct(productLabel);
  const group = issueGroup(rec.category ?? "", rec.title, rec.detail ?? "");
  const sanitized = sanitizeReplenishmentLanguage(rec.title, rec.detail ?? "");
  return {
    id: rec.id,
    title: sanitized.title,
    detail: rec.detail ?? "",
    category: rec.category ?? "",
    priority: normPriority(rec.impact),
    product_name,
    brand,
    issue_group: group,
    issue_type: issueTypeLabel(group),
    expected_value: parsed.expected_value,
    observed_value: parsed.observed_value,
    shelf: parsed.shelf,
    location: parsed.location,
    is_review: sanitized.is_review,
    sort_rank: group === "planogram_compliance" ? 50 : group === "competitive" ? 40 : 10,
    evidence_target: evidenceTarget(group),
    sku: undefined,
  };
}

function enrichFromPlanogram(result: ScanResult, raw: RawAction[]): RawAction[] {
  const positions = buildPositionComparisons(result);
  const byProduct = new Map(
    positions
      .filter((p) => p.status !== "match")
      .map((p) => [`${p.row.brand}|${p.row.product_name}`.toLowerCase(), p]),
  );

  return raw.map((item) => {
    const key = `${item.brand}|${item.product_name}`.toLowerCase();
    const pos = byProduct.get(key);
    if (!pos) return item;
    return {
      ...item,
      sku: pos.row.sku,
      shelf: item.shelf ?? pos.shelf_label,
      location: item.location ?? pos.observed_location ?? pos.position_id,
      expected_value:
        item.expected_value ??
        (pos.expected_facings ? `${pos.expected_facings} facings` : undefined),
      observed_value:
        item.observed_value ??
        (pos.observed_facings !== undefined ? `${pos.observed_facings} facings` : undefined),
      is_review: item.is_review || pos.status === "review" || pos.status === "missing",
    };
  });
}

function mergeGroup(
  key: string,
  items: RawAction[],
  result: ScanResult,
): RecommendedActionCard {
  const group = items[0]!.issue_group;
  const product =
    items.find((i) => i.product_name && i.product_name !== i.brand)?.product_name ??
    items[0]!.product_name;
  const brand = items[0]!.brand;
  const rank = { high: 3, medium: 2, low: 1 };
  const priority = items.reduce<ActionPriority>(
    (best, i) => (rank[i.priority] > rank[best] ? i.priority : best),
    "low",
  );
  const is_review = items.some((i) => i.is_review);
  const explanations = [...new Set(items.map((i) => i.detail).filter(Boolean))];
  const title = actionTitle(group, product ? `${brand} ${product}`.trim() : "", items);

  const promo = isDemoOralCareResult(result) ? demoPromotionalCompliance() : null;

  return {
    id: `group-${key}`,
    title,
    priority,
    issue_type: issueTypeLabel(group),
    explanation: explanations.join(" "),
    expected_result: items.find((i) => i.expected_value)?.expected_value,
    observed_result: items.find((i) => i.observed_value)?.observed_value,
    expected_value: items.find((i) => i.expected_value)?.expected_value,
    observed_value: items.find((i) => i.observed_value)?.observed_value,
    shelf:
      items.find((i) => i.shelf)?.shelf ??
      (promo && group === "price_promotion" ? "Shelf 1" : undefined),
    location: items.find((i) => i.location)?.location,
    recommended_action: recommendedActionText(group, is_review),
    review_status: is_review ? "Needs review" : "Action required",
    evidence_target: items[0]!.evidence_target,
    evidence_label: is_review ? "Review Evidence" : "View Evidence",
    is_review,
    sort_rank: Math.min(...items.map((i) => i.sort_rank)),
    source_ids: items.map((i) => i.id),
    sku: items.find((i) => i.sku)?.sku,
    brand,
    product_name: product,
    confidence: undefined,
    coverage: undefined,
  };
}

function groupKey(item: RawAction): string {
  const product = (item.product_name || item.brand || "general").toLowerCase().replace(/\s+/g, " ");
  let group = item.issue_group;
  if (group === "facings" && /promo|price/i.test(`${item.title} ${item.detail}`)) {
    group = "price_promotion";
  }
  return `${product}|${group}`;
}

export function buildPrioritySummary(cards: RecommendedActionCard[]): PrioritySummary {
  return {
    high: cards.filter((c) => c.priority === "high").length,
    medium: cards.filter((c) => c.priority === "medium").length,
    low: cards.filter((c) => c.priority === "low").length,
  };
}

export function buildIssueTypeCounts(cards: RecommendedActionCard[]): IssueTypeCount[] {
  const map = new Map<string, number>();
  for (const card of cards) {
    map.set(card.issue_type, (map.get(card.issue_type) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([issue_type, count], i) => ({
      issue_type,
      count,
      bar_class: ISSUE_BAR[i % ISSUE_BAR.length]!,
    }))
    .sort((a, b) => b.count - a.count);
}

function sortActionCards(cards: RecommendedActionCard[]): RecommendedActionCard[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...cards].sort((a, b) => {
    const pd = order[a.priority] - order[b.priority];
    if (pd !== 0) return pd;
    if (a.priority === "high" && b.priority === "high" && a.is_review !== b.is_review) {
      return a.is_review ? 1 : -1;
    }
    return a.sort_rank - b.sort_rank;
  });
}

export function buildRecommendedActionCards(result: ScanResult): RecommendedActionCard[] {
  const recs = priorityRecommendations(result.recommendations);
  let raw = recs.map(rawFromRecommendation);
  raw = enrichFromPlanogram(result, raw);

  const groups = new Map<string, RawAction[]>();
  for (const item of raw) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const cards = [...groups.entries()].map(([key, items]) => mergeGroup(key, items, result));
  return sortActionCards(cards);
}

export function scrollToActionEvidence(target: string) {
  const el =
    document.getElementById(target) ??
    document.getElementById("kpi-evidence-planogram_compliance") ??
    document.getElementById("audit-section-planogram");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function recommendedActionsMeta(result: ScanResult) {
  const rows = planogramRowsFromResult(result);
  return {
    audit_id: result.location ?? result.scan_id ?? "",
    audit_date: result.created_at ?? "",
    store: result.store ?? "Demo Supermarket",
    fixture: rows[0]?.location ?? DEMO_ORAL_CARE_META.fixture_id ?? "",
    role: result.retail_intelligence?.audit_kpi_dashboard?.role_id ?? "",
    category: result.scan_category ?? DEMO_ORAL_CARE_META.category,
    sub_category: result.scan_sub_category ?? DEMO_ORAL_CARE_META.sub_category,
    planogram_version: DEMO_ORAL_CARE_META.version,
  };
}
