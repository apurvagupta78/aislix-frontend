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

const SECTIONS_BY_VIEW: Record<ResultViewMode, ResultSectionKey[]> = {
  execution: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "facings_strip",
    "action_center",
    "placement_alert",
    "recommended_actions",
    "planogram",
    "review_queue",
    "annotated_image",
    "inventory",
    "downloads",
    "share",
    "scan_details",
  ],
  merchandising: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "facings_strip",
    "action_center",
    "sku_availability",
    "share_of_shelf",
    "planogram",
    "recommended_actions",
    "review_queue",
    "inventory",
    "analytics",
    "downloads",
    "share",
  ],
  brand: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "competitor_intel",
    "share_of_shelf",
    "sku_availability",
    "recommended_actions",
    "planogram",
    "ai_summary",
    "inventory",
    "analytics",
    "downloads",
    "share",
  ],
  executive: [
    "improvement_banner",
    "score_hero",
    "kpi_strip",
    "ai_summary",
    "competitor_intel",
    "action_center",
    "recommended_actions",
    "share",
    "scan_details",
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

export function visibleSections(
  viewMode: ResultViewMode,
  roleFamily?: RoleFamily,
): Set<ResultSectionKey> {
  let sections = SECTIONS_BY_VIEW[viewMode] ?? ALL_SECTIONS;
  if (roleFamily === "field") {
    sections = sections.filter((s) => s !== "analytics" && s !== "competitor_intel");
  }
  if (roleFamily === "executive") {
    sections = sections.filter((s) => !["review_queue", "annotated_image"].includes(s));
  }
  return new Set(sections);
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
