/**
 * Issues to fix — grouped action layer (display only; no detection changes).
 */

import type { PlanogramComparison } from "@/lib/planogram-compliance";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
import {
  buildAllDemoActions,
  buildDetailedActions,
  type DetailedActionItem,
} from "@/lib/scan-execution";
import type { ScanResult } from "@/lib/scan-results";
import {
  buildUnifiedExceptions,
  exceptionCategoryLabel,
  exceptionCountsByCategory,
  type ExceptionCategory,
  type UnifiedException,
} from "@/lib/unified-exceptions";
import { scrollToActionEvidence, type ActionPriority } from "@/lib/recommended-actions-display";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { ResultViewMode } from "@/lib/customer-context";

export type ActionStatus = "Open" | "In Review" | "Actioned" | "Re-audit Required" | "Resolved";

export type IssueItem = {
  id: string;
  title: string;
  priority: ActionPriority;
  issue_type: string;
  explanation: string;
  expected?: string;
  observed?: string;
  expected_value?: string;
  observed_value?: string;
  next_step: string;
  evidence_target: string;
  evidence_label: "View Evidence" | "Review Evidence";
  is_review: boolean;
  review_status: string;
  action_status: ActionStatus;
  sku?: string;
  brand?: string;
  product_name?: string;
  shelf?: string;
  location?: string;
  group_key: ExceptionCategory;
  confidence?: string;
  coverage?: string;
};

export type IssueGroup = {
  id: string;
  group_key: ExceptionCategory;
  group_name: string;
  action_title: string;
  count: number;
  priority: ActionPriority;
  issue_type: string;
  explanation: string;
  next_step: string;
  evidence_target: string;
  items: IssueItem[];
};

export type IssuesToFixView = {
  total: number;
  summary: { high: number; medium: number; low: number };
  groups: IssueGroup[];
  type_counts: { label: string; count: number; bar_class: string }[];
};

const TYPE_BAR = ["bg-brand", "bg-brand/70", "bg-brand/55", "bg-brand/40", "bg-brand/30"] as const;

const GROUP_EVIDENCE: Record<ExceptionCategory, string> = {
  availability: "kpi-evidence-osa",
  placement: "audit-section-planogram",
  planogram: "audit-section-planogram",
  pricing: "kpi-evidence-price_compliance",
  promotion: "kpi-evidence-promotional_compliance",
  review: "kpi-evidence-osa",
  compliance: "audit-section-planogram",
  action: "kpi-evidence-planogram_compliance",
  opportunity: "kpi-evidence-osa",
};

function normPriority(severity: UnifiedException["severity"] | DetailedActionItem["priority"]): ActionPriority {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function rank(p: ActionPriority): number {
  return p === "high" ? 3 : p === "medium" ? 2 : 1;
}

function sanitizeReplenishTitle(title: string, detail: string): { title: string; is_review: boolean } {
  const blob = `${title} ${detail}`.toLowerCase();
  const uncertain =
    blob.includes("not detected") ||
    blob.includes("not confidently") ||
    blob.includes("verify") ||
    blob.includes("before replenishment") ||
    blob.includes("review before");
  if (/replenish|restock|out-of-stock sku/i.test(title)) {
    const countMatch = title.match(/(\d+)/);
    const n = countMatch?.[1] ?? "";
    return {
      title: n ? `Review ${n} missing product${n === "1" ? "" : "s"}` : "Review missing products",
      is_review: true,
    };
  }
  if (/replenish or replace/i.test(detail)) {
    return { title: title.replace(/^Planogram:\s*/i, "Fix ").replace(/$/, " placement"), is_review: uncertain };
  }
  return { title, is_review: uncertain };
}

function nextStepFor(category: ExceptionCategory, is_review: boolean): string {
  if (is_review) {
    if (category === "availability") return "Review shelf coverage before replenishment.";
    return "Review evidence before confirming corrective action.";
  }
  switch (category) {
    case "availability":
      return "Verify shelf coverage and restock only after confirmation.";
    case "placement":
      return "Move products to the correct section and re-audit.";
    case "planogram":
      return "Correct placement or facings per planogram, then re-audit.";
    case "pricing":
      return "Update shelf price to match the configured value.";
    case "promotion":
      return "Align promotional price with the campaign terms.";
    default:
      return "Take corrective action and re-audit to verify.";
  }
}

function parseProductFromTitle(title: string): { brand?: string; product_name?: string } {
  const plano = title.match(/^Planogram:\s*(.+)$/i);
  if (plano?.[1]) {
    const parts = plano[1].trim().split(/\s+/);
    return { brand: parts[0], product_name: parts.slice(1).join(" ") || parts[0] };
  }
  const short = title.match(/^Short on\s+(.+)$/i);
  if (short?.[1]) {
    const parts = short[1].trim().split(/\s+/);
    return { brand: parts[0], product_name: parts.slice(1).join(" ") || parts[0] };
  }
  return {};
}

function itemTitle(item: IssueItem, groupKey: ExceptionCategory): string {
  if (groupKey === "planogram") {
    const name = [item.brand, item.product_name].filter(Boolean).join(" ").trim();
    if (name) return `Fix ${name} placement`;
  }
  return item.title;
}

function mapException(row: UnifiedException): IssueItem {
  const sanitized = sanitizeReplenishTitle(row.title, row.detail ?? "");
  const product = parseProductFromTitle(sanitized.title);
  const is_review = sanitized.is_review || row.severity === "medium" && row.category === "availability";
  return {
    id: row.id,
    title: sanitized.title,
    priority: normPriority(row.severity),
    issue_type: exceptionCategoryLabel(row.category),
    explanation: row.detail ?? "",
    expected: row.expected,
    observed: row.actual,
    expected_value: row.expected,
    observed_value: row.actual,
    next_step: nextStepFor(row.category, is_review),
    evidence_target: GROUP_EVIDENCE[row.category],
    evidence_label: is_review ? "Review Evidence" : "View Evidence",
    is_review,
    review_status: is_review ? "Needs confirmation" : "Action required",
    action_status: is_review ? "In Review" : "Open",
    brand: product.brand,
    product_name: product.product_name,
    group_key: row.category,
  };
}

function categorizeDetailed(action: DetailedActionItem): ExceptionCategory {
  const blob = `${action.title} ${action.reason}`.toLowerCase();
  if (blob.includes("promo")) return "promotion";
  if (blob.includes("price")) return "pricing";
  if (blob.includes("planogram")) return "planogram";
  if (blob.includes("placement") || blob.includes("misplaced")) return "placement";
  if (
    blob.includes("oos") ||
    blob.includes("replenish") ||
    blob.includes("restock") ||
    blob.includes("missing") ||
    blob.includes("absence") ||
    blob.includes("stock")
  )
    return "availability";
  return "action";
}

function mapDetailed(action: DetailedActionItem): IssueItem {
  const category = categorizeDetailed(action);
  const sanitized = sanitizeReplenishTitle(action.title, action.reason);
  const product = parseProductFromTitle(sanitized.title);
  const is_review = sanitized.is_review;
  return {
    id: action.action_id,
    title: sanitized.title,
    priority: normPriority(action.priority),
    issue_type: exceptionCategoryLabel(category),
    explanation: action.reason,
    expected: action.expected_state,
    observed: action.actual_state,
    expected_value: action.expected_state,
    observed_value: action.actual_state,
    next_step: action.recommended_action || nextStepFor(category, is_review),
    evidence_target: GROUP_EVIDENCE[category],
    evidence_label: is_review ? "Review Evidence" : "View Evidence",
    is_review,
    review_status: is_review ? "Needs confirmation" : "Action required",
    action_status: is_review ? "In Review" : "Open",
    brand: product.brand,
    product_name: product.product_name,
    group_key: category,
  };
}

function groupActionTitle(key: ExceptionCategory, count: number, items: IssueItem[]): string {
  switch (key) {
    case "availability":
      return `Review ${count} missing product${count === 1 ? "" : "s"}`;
    case "placement":
      return `Fix ${count} placement issue${count === 1 ? "" : "s"}`;
    case "planogram":
      return `Fix ${count} planogram issue${count === 1 ? "" : "s"}`;
    case "pricing":
      return `Fix ${count} price issue${count === 1 ? "" : "s"}`;
    case "promotion":
      return `Fix ${count} promotion issue${count === 1 ? "" : "s"}`;
    case "review":
      return `Review ${count} recognition item${count === 1 ? "" : "s"}`;
    case "compliance":
      return `Fix ${count} compliance issue${count === 1 ? "" : "s"}`;
    default:
      return items[0]?.title ?? `${count} issue${count === 1 ? "" : "s"} to fix`;
  }
}

function groupExplanation(key: ExceptionCategory, items: IssueItem[]): string {
  if (key === "availability") {
    return `${items.length} expected product${items.length === 1 ? " was" : "s were"} not confidently detected in the audited shelf area.`;
  }
  if (key === "placement") {
    return "Products appear outside expected category or shelf position.";
  }
  if (key === "planogram") {
    return "Shelf layout differs from the configured planogram.";
  }
  return items[0]?.explanation ?? "";
}

function buildGroups(items: IssueItem[]): IssueGroup[] {
  const map = new Map<ExceptionCategory, IssueItem[]>();
  for (const item of items) {
    const list = map.get(item.group_key) ?? [];
    list.push(item);
    map.set(item.group_key, list);
  }

  const order: ExceptionCategory[] = [
    "availability",
    "placement",
    "planogram",
    "pricing",
    "promotion",
    "compliance",
    "review",
    "action",
    "opportunity",
  ];

  return order
    .filter((key) => map.has(key))
    .map((key) => {
      const groupItems = map.get(key)!;
      const priority = groupItems.reduce<ActionPriority>(
        (best, i) => (rank(i.priority) > rank(best) ? i.priority : best),
        "low",
      );
      return {
        id: `group-${key}`,
        group_key: key,
        group_name: exceptionCategoryLabel(key),
        action_title: groupActionTitle(key, groupItems.length, groupItems),
        count: groupItems.length,
        priority,
        issue_type: exceptionCategoryLabel(key),
        explanation: groupExplanation(key, groupItems),
        next_step: nextStepFor(key, groupItems.some((i) => i.is_review)),
        evidence_target: GROUP_EVIDENCE[key],
        items: groupItems.map((item) => ({ ...item, title: itemTitle(item, key) })),
      };
    })
    .sort((a, b) => rank(b.priority) - rank(a.priority));
}

function buildTypeCounts(items: IssueItem[]): IssuesToFixView["type_counts"] {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.issue_type, (map.get(item.issue_type) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({
      label,
      count,
      bar_class: TYPE_BAR[i % TYPE_BAR.length]!,
    }));
}

export function buildIssuesToFixView(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
  demoMode?: boolean,
  view?: ResultViewMode,
): IssuesToFixView {
  const comp = comparison ?? planogramComparisonFromResult(result);
  let items: IssueItem[] = [];

  if (demoMode) {
    items = buildAllDemoActions(result, view).map(mapDetailed);
  } else {
    items = buildUnifiedExceptions(result, comp, view).map(mapException);
    if (!items.length) {
      items = buildDetailedActions(result, view).map(mapDetailed);
    }
  }

  const seen = new Set<string>();
  items = items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  items.sort((a, b) => {
    const pd = rank(b.priority) - rank(a.priority);
    if (pd !== 0) return pd;
    if (a.is_review !== b.is_review) return a.is_review ? 1 : -1;
    return 0;
  });

  const summary = {
    high: items.filter((i) => i.priority === "high").length,
    medium: items.filter((i) => i.priority === "medium").length,
    low: items.filter((i) => i.priority === "low").length,
  };

  return {
    total: items.length,
    summary,
    groups: buildGroups(items),
    type_counts: buildTypeCounts(items),
  };
}

export function issuesToFixMeta(result: ScanResult) {
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

export { scrollToActionEvidence, exceptionCountsByCategory };
