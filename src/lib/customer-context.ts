/**
 * Customer type + role family — drives onboarding copy and /results presentation.
 * One scan engine; this layer chooses which panels each persona sees.
 */

export type CustomerType =
  | "fmcg"
  | "supermarket"
  | "darkstore"
  | "warehouse"
  | "distributor"
  | "local"
  | "audit_agency";

export type RoleFamily =
  | "field"
  | "store_ops"
  | "merchandising"
  | "operations"
  | "commercial"
  | "executive";

export type ResultViewMode = "execution" | "merchandising" | "brand" | "executive" | "exceptions";

export type ResultSectionKey =
  | "improvement_banner"
  | "score_hero"
  | "kpi_strip"
  | "facings_strip"
  | "action_center"
  | "financial_impact"
  | "placement_alert"
  | "ai_summary"
  | "share_of_shelf"
  | "competitor_intel"
  | "sku_availability"
  | "recommended_actions"
  | "planogram"
  | "review_queue"
  | "annotated_image"
  | "inventory"
  | "analytics"
  | "alerts"
  | "downloads"
  | "share"
  | "scan_details"
  | "image_quality"
  | "assortment"
  | "opportunity_ledger"
  | "verified_execution"
  | "historical_intel"
  | "presentability"
  | "fix_rescan_cta"
  | "audit_scope"
  | "pricing_compliance"
  | "multi_photo"
  | "unified_exceptions"
  | "planogram_side_by_side"
  | "bbox_annotation";

export type CustomerContext = {
  customerType: CustomerType;
  roleFamily: RoleFamily;
  jobTitle: string;
  viewMode: ResultViewMode;
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  fmcg: "FMCG / Brand",
  supermarket: "Supermarket / Hypermarket",
  darkstore: "Dark store",
  warehouse: "Warehouse",
  distributor: "Distributor",
  local: "Local / Kirana store",
  audit_agency: "Retail audit / Field agency",
};

export const ROLE_FAMILY_LABELS: Record<RoleFamily, string> = {
  field: "Field executive",
  store_ops: "Store operator",
  merchandising: "Category / merchandising",
  operations: "Operations manager",
  commercial: "Commercial / brand",
  executive: "Executive",
};

export const VIEW_MODE_LABELS: Record<ResultViewMode, string> = {
  execution: "Execution",
  merchandising: "Merchandising",
  brand: "Brand intelligence",
  executive: "Executive summary",
  exceptions: "Exceptions",
};

/** Distinct accent per role tab — shared by demo and dashboard results. */
export type ViewModeTheme = {
  tabActive: string;
  tabInactive: string;
  accentText: string;
  accentBorder: string;
  accentSoft: string;
  ring: string;
};

/** Shared inactive tab styling — neutral surface aligned with Aislix brand. */
const TAB_INACTIVE =
  "border border-border bg-background text-muted-foreground hover:border-brand/25 hover:bg-brand-soft/40 hover:text-foreground";

export const VIEW_MODE_THEME: Record<ResultViewMode, ViewModeTheme> = {
  execution: {
    tabActive: "bg-brand text-brand-foreground shadow-sm hover:bg-brand",
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/50",
    ring: "ring-brand/25",
  },
  merchandising: {
    tabActive: "bg-brand-muted text-white shadow-sm hover:bg-brand-muted",
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand-muted",
    accentBorder: "border-brand/15",
    accentSoft: "bg-brand-soft/35",
    ring: "ring-brand-muted/25",
  },
  brand: {
    tabActive: "bg-foreground text-background shadow-sm hover:bg-foreground",
    tabInactive: TAB_INACTIVE,
    accentText: "text-foreground",
    accentBorder: "border-border",
    accentSoft: "bg-muted/60",
    ring: "ring-foreground/15",
  },
  executive: {
    tabActive: "bg-primary text-primary-foreground shadow-sm hover:bg-primary",
    tabInactive: TAB_INACTIVE,
    accentText: "text-primary",
    accentBorder: "border-primary/20",
    accentSoft: "bg-muted/50",
    ring: "ring-primary/20",
  },
  exceptions: {
    tabActive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive",
    tabInactive: TAB_INACTIVE,
    accentText: "text-destructive",
    accentBorder: "border-destructive/20",
    accentSoft: "bg-destructive/5",
    ring: "ring-destructive/20",
  },
};

/** Job titles offered per customer type during onboarding. */
export const JOB_TITLES_BY_CUSTOMER: Record<CustomerType, string[]> = {
  fmcg: [
    "Brand manager",
    "Trade marketing manager",
    "Key account manager",
    "Field sales executive",
    "Category manager",
  ],
  supermarket: [
    "Store manager",
    "Category manager",
    "Merchandising executive",
    "Replenishment manager",
    "Floor supervisor",
  ],
  darkstore: [
    "Dark store manager",
    "Picker lead",
    "Inventory controller",
    "Operations lead",
  ],
  warehouse: [
    "Warehouse manager",
    "Inventory auditor",
    "Fulfillment lead",
  ],
  distributor: [
    "Sales executive",
    "Territory manager",
    "Distributor owner",
  ],
  local: [
    "Store owner",
    "Store manager",
    "Shelf organizer",
  ],
  audit_agency: [
    "Field auditor",
    "Audit supervisor",
    "Client success manager",
  ],
};

const ALL_SECTIONS: ResultSectionKey[] = [
  "improvement_banner",
  "score_hero",
  "kpi_strip",
  "facings_strip",
  "action_center",
  "financial_impact",
  "placement_alert",
  "ai_summary",
  "share_of_shelf",
  "competitor_intel",
  "sku_availability",
  "recommended_actions",
  "planogram",
  "review_queue",
  "annotated_image",
  "inventory",
  "analytics",
  "alerts",
  "downloads",
  "share",
  "scan_details",
];

/** Short subtitle shown under the view switcher — explains what each tab emphasizes. */
export const VIEW_MODE_DESCRIPTIONS: Record<ResultViewMode, string> = {
  execution:
    "Operational view — annotated shelf, action items, placement issues, and AI review queue.",
  merchandising:
    "Category view — share of shelf, SKU availability, planogram compliance, and analytics.",
  brand:
    "Brand intelligence — competitor presence, shelf share, and commercial recommendations.",
  executive:
    "Executive snapshot — scores, financial impact, AI summary, and key actions.",
  exceptions:
    "All audit exceptions — planogram gaps, pricing, compliance, and AI review in one dashboard.",
};

const SECTIONS_BY_VIEW: Record<ResultViewMode, ResultSectionKey[]> = {
  execution: [
    "improvement_banner",
    "verified_execution",
    "multi_photo",
    "score_hero",
    "image_quality",
    "audit_scope",
    "kpi_strip",
    "annotated_image",
    "facings_strip",
    "action_center",
    "fix_rescan_cta",
    "opportunity_ledger",
    "placement_alert",
    "sku_availability",
    "planogram",
    "planogram_side_by_side",
    "presentability",
    "pricing_compliance",
    "financial_impact",
    "review_queue",
    "recommended_actions",
    "inventory",
    "downloads",
    "share",
    "scan_details",
  ],
  merchandising: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "image_quality",
    "annotated_image",
    "share_of_shelf",
    "assortment",
    "sku_availability",
    "presentability",
    "planogram",
    "planogram_side_by_side",
    "pricing_compliance",
    "analytics",
    "financial_impact",
    "opportunity_ledger",
    "recommended_actions",
    "inventory",
    "downloads",
    "share",
  ],
  brand: [
    "improvement_banner",
    "score_hero",
    "annotated_image",
    "competitor_intel",
    "share_of_shelf",
    "assortment",
    "sku_availability",
    "planogram",
    "financial_impact",
    "opportunity_ledger",
    "ai_summary",
    "recommended_actions",
    "analytics",
    "inventory",
    "downloads",
    "share",
  ],
  executive: [
    "improvement_banner",
    "verified_execution",
    "score_hero",
    "kpi_strip",
    "historical_intel",
    "annotated_image",
    "financial_impact",
    "opportunity_ledger",
    "ai_summary",
    "planogram",
    "competitor_intel",
    "recommended_actions",
    "share",
    "scan_details",
    "downloads",
  ],
  exceptions: [
    "unified_exceptions",
    "planogram_side_by_side",
    "bbox_annotation",
    "review_queue",
    "planogram",
    "placement_alert",
    "recommended_actions",
    "annotated_image",
    "scan_details",
  ],
};

/** Customer-mode section emphasis (merged with role view). */
const CUSTOMER_SECTION_BOOST: Partial<Record<CustomerType, ResultSectionKey[]>> = {
  darkstore: ["sku_availability", "planogram", "action_center", "fix_rescan_cta"],
  fmcg: ["competitor_intel", "share_of_shelf", "opportunity_ledger", "financial_impact"],
  local: ["action_center", "opportunity_ledger", "financial_impact", "fix_rescan_cta"],
  distributor: ["assortment", "sku_availability", "inventory"],
  supermarket: ["sku_availability", "planogram", "presentability", "share_of_shelf"],
};

const DEFAULT_VIEW_BY_ROLE: Record<RoleFamily, ResultViewMode> = {
  field: "execution",
  store_ops: "execution",
  merchandising: "merchandising",
  operations: "merchandising",
  commercial: "brand",
  executive: "executive",
};

const DEFAULT_VIEW_BY_CUSTOMER: Partial<Record<CustomerType, ResultViewMode>> = {
  fmcg: "brand",
  local: "execution",
  audit_agency: "execution",
};

export function normalizeCustomerType(value?: string | null): CustomerType {
  const key = (value ?? "").trim().toLowerCase();
  if (key in CUSTOMER_TYPE_LABELS) return key as CustomerType;
  if (key === "fmcg brand") return "fmcg";
  return "supermarket";
}

export function normalizeRoleFamily(value?: string | null): RoleFamily {
  const key = (value ?? "").trim().toLowerCase();
  if (key in ROLE_FAMILY_LABELS) return key as RoleFamily;
  return "operations";
}

/** Infer role family from a free-text job title. */
export function inferRoleFamily(jobTitle: string, customerType?: CustomerType): RoleFamily {
  const t = jobTitle.trim().toLowerCase();
  if (!t) {
    if (customerType === "fmcg") return "commercial";
    if (customerType === "audit_agency" || customerType === "distributor") return "field";
    if (customerType === "local") return "store_ops";
    return "operations";
  }
  if (/executive|ceo|coo|founder|director|vp|head of/.test(t)) return "executive";
  if (/brand|trade marketing|commercial|account manager|key account/.test(t)) return "commercial";
  if (/category|merchandis|planogram|visual/.test(t)) return "merchandising";
  if (/field|auditor|sales exec|promoter|merchandiser/.test(t)) return "field";
  if (/store manager|store owner|floor|shift|picker|kirana/.test(t)) return "store_ops";
  if (/operations|ops|warehouse|inventory|replenish|dark store/.test(t)) return "operations";
  return "operations";
}

export function defaultViewMode(
  roleFamily: RoleFamily,
  customerType: CustomerType,
): ResultViewMode {
  return DEFAULT_VIEW_BY_CUSTOMER[customerType] ?? DEFAULT_VIEW_BY_ROLE[roleFamily];
}

export function orderedVisibleSections(
  viewMode: ResultViewMode,
  roleFamily?: RoleFamily,
  customerType?: CustomerType,
): ResultSectionKey[] {
  let sections = [...(SECTIONS_BY_VIEW[viewMode] ?? ALL_SECTIONS)];
  if (roleFamily === "field") {
    sections = sections.filter((s) => s !== "analytics" && s !== "competitor_intel");
  }
  const boost = customerType ? CUSTOMER_SECTION_BOOST[customerType] : undefined;
  if (boost?.length) {
    const boosted = boost.filter((s) => !sections.includes(s));
    sections = [...sections, ...boosted];
  }
  return sections;
}

export function visibleSections(
  viewMode: ResultViewMode,
  roleFamily?: RoleFamily,
): Set<ResultSectionKey> {
  return new Set(orderedVisibleSections(viewMode, roleFamily));
}

export function showCompetitorIntel(
  customerType: CustomerType,
  roleFamily: RoleFamily,
  hasBrandConfig: boolean,
): boolean {
  if (!hasBrandConfig) return false;
  if (customerType === "fmcg" || customerType === "distributor") return true;
  return roleFamily === "commercial" || roleFamily === "executive" || roleFamily === "merchandising";
}

/** Which result tabs a role may switch between (default tab still applies). */
export function allowedViewModes(
  roleFamily: RoleFamily,
  customerType?: CustomerType,
): ResultViewMode[] {
  switch (roleFamily) {
    case "field":
      return ["execution", "exceptions"];
    case "store_ops":
      return ["execution", "exceptions", "merchandising"];
    case "merchandising":
    case "operations":
      return ["execution", "exceptions", "merchandising", "brand"];
    case "commercial":
      return customerType === "fmcg"
        ? ["brand", "merchandising", "exceptions", "execution"]
        : ["brand", "merchandising", "exceptions", "executive"];
    case "executive":
      return ["executive", "exceptions", "merchandising", "brand", "execution"];
    default:
      return ["execution", "exceptions", "merchandising", "brand", "executive"];
  }
}

export const ROLE_HERO: Record<ResultViewMode, string> = {
  execution: "What needs attention?",
  merchandising: "How is my category performing?",
  brand: "How is my brand performing against competitors?",
  executive: "Where should I intervene?",
  exceptions: "What failed the audit?",
};
