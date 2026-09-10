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

export type ResultViewMode = "execution" | "merchandising" | "brand" | "executive";

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
  | "scan_details";

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

export const VIEW_MODE_THEME: Record<ResultViewMode, ViewModeTheme> = {
  execution: {
    tabActive: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-600",
    tabInactive:
      "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    accentText: "text-emerald-700 dark:text-emerald-300",
    accentBorder: "border-emerald-200 dark:border-emerald-800",
    accentSoft: "bg-emerald-50/80 dark:bg-emerald-950/30",
    ring: "ring-emerald-500/30",
  },
  merchandising: {
    tabActive: "bg-violet-600 text-white shadow-sm hover:bg-violet-600",
    tabInactive:
      "border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
    accentText: "text-violet-700 dark:text-violet-300",
    accentBorder: "border-violet-200 dark:border-violet-800",
    accentSoft: "bg-violet-50/80 dark:bg-violet-950/30",
    ring: "ring-violet-500/30",
  },
  brand: {
    tabActive: "bg-amber-600 text-white shadow-sm hover:bg-amber-600",
    tabInactive:
      "border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    accentText: "text-amber-800 dark:text-amber-300",
    accentBorder: "border-amber-200 dark:border-amber-800",
    accentSoft: "bg-amber-50/80 dark:bg-amber-950/30",
    ring: "ring-amber-500/30",
  },
  executive: {
    tabActive: "bg-slate-700 text-white shadow-sm hover:bg-slate-700 dark:bg-slate-600",
    tabInactive:
      "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
    accentText: "text-slate-700 dark:text-slate-300",
    accentBorder: "border-slate-200 dark:border-slate-700",
    accentSoft: "bg-slate-100/80 dark:bg-slate-900/40",
    ring: "ring-slate-500/30",
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
};

const SECTIONS_BY_VIEW: Record<ResultViewMode, ResultSectionKey[]> = {
  execution: [
    "improvement_banner",
    "score_hero",
    "annotated_image",
    "kpi_strip",
    "facings_strip",
    "action_center",
    "placement_alert",
    "review_queue",
    "recommended_actions",
    "planogram",
    "financial_impact",
    "inventory",
    "downloads",
    "share",
    "scan_details",
  ],
  merchandising: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "annotated_image",
    "share_of_shelf",
    "sku_availability",
    "planogram",
    "analytics",
    "financial_impact",
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
    "sku_availability",
    "financial_impact",
    "ai_summary",
    "recommended_actions",
    "analytics",
    "inventory",
    "downloads",
    "share",
  ],
  executive: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "annotated_image",
    "financial_impact",
    "ai_summary",
    "competitor_intel",
    "recommended_actions",
    "share",
    "scan_details",
    "downloads",
  ],
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
): ResultSectionKey[] {
  let sections = SECTIONS_BY_VIEW[viewMode] ?? ALL_SECTIONS;
  if (roleFamily === "field") {
    sections = sections.filter((s) => s !== "analytics" && s !== "competitor_intel");
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
      return ["execution"];
    case "store_ops":
      return ["execution", "merchandising"];
    case "merchandising":
    case "operations":
      return ["execution", "merchandising", "brand"];
    case "commercial":
      return customerType === "fmcg"
        ? ["brand", "merchandising", "execution"]
        : ["brand", "merchandising", "executive"];
    case "executive":
      return ["executive", "merchandising", "brand", "execution"];
    default:
      return ["execution", "merchandising", "brand", "executive"];
  }
}

export const ROLE_HERO: Record<ResultViewMode, string> = {
  execution: "What needs attention?",
  merchandising: "How is my category performing?",
  brand: "How is my brand performing against competitors?",
  executive: "Where should I intervene?",
};
