import {
  Building2,
  Factory,
  MapPin,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";

import type { HelpOperatingRole } from "@/lib/ask-aislix/help-ask-aislix.types";

export type HelpRoleCard = {
  id: HelpOperatingRole;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const HELP_ROLE_CARDS: HelpRoleCard[] = [
  {
    id: "supermarket",
    label: "Supermarkets",
    description: "Understand shelf execution, products, pricing and store performance.",
    icon: ShoppingBag,
  },
  {
    id: "fmcg_distributor",
    label: "FMCG / Distributors",
    description: "Analyze outlets, distributors, availability and field execution.",
    icon: MapPin,
  },
  {
    id: "local_store",
    label: "Local Stores",
    description: "Understand inventory, shelf, expiry and store-level execution.",
    icon: Store,
  },
  {
    id: "dark_store",
    label: "Dark Stores",
    description: "Analyze inventory, expiry, picking and operational accuracy.",
    icon: Building2,
  },
  {
    id: "warehouse",
    label: "Warehouse",
    description: "Analyze receiving, putaway, inventory and warehouse execution.",
    icon: Factory,
  },
];

export type HelpTopicConfig = {
  id: string;
  label: string;
  needsProduct?: boolean;
  needsMetric?: boolean;
  needsGrouping?: boolean;
  productDimensions?: string[];
  groupByOptions?: string[];
  /** When false, topic is hidden — no wired Ask Aislix tool yet. */
  available?: boolean;
};

export type HelpMetricOption = {
  id: string;
  label: string;
  available: boolean;
  comingSoon?: boolean;
};

const AUDIT_METRICS: HelpMetricOption[] = [
  { id: "audit_completion", label: "Audit Completion", available: true },
  { id: "audit_pass", label: "Pass Rate", available: false, comingSoon: true },
  { id: "evidence_coverage", label: "Evidence Coverage", available: false, comingSoon: true },
];

const FINDINGS_METRICS: HelpMetricOption[] = [
  { id: "open_findings", label: "Open Findings", available: true },
  { id: "critical_findings", label: "Critical Findings", available: true },
];

const CA_METRICS: HelpMetricOption[] = [
  { id: "open_actions", label: "Open Actions", available: true },
  { id: "overdue_actions", label: "Overdue Actions", available: true },
  { id: "sla_compliance", label: "SLA Compliance", available: false, comingSoon: true },
];

const INVENTORY_METRICS: HelpMetricOption[] = [
  { id: "value_variance", label: "Potential Inventory Value Variance", available: true },
  { id: "inventory_accuracy", label: "Inventory Accuracy", available: false, comingSoon: true },
];

const EXPIRY_METRICS: HelpMetricOption[] = [
  { id: "expiry_risk", label: "Expiry Risk", available: true },
  { id: "near_expiry_units", label: "Near-Expiry Units", available: false, comingSoon: true },
  { id: "expired_units", label: "Expired Units", available: false, comingSoon: true },
];

const STORE_GROUP = ["store", "city", "category", "brand", "day", "week", "month"];
const FMCG_GROUP = ["outlet", "distributor", "city", "sales_rep", "beat", "brand", "sku", "day", "week", "month"];
const WAREHOUSE_GROUP = ["warehouse", "zone", "aisle", "rack", "bin", "sku", "day", "week", "month"];

function topic(
  id: string,
  label: string,
  extra: Partial<HelpTopicConfig> = {},
): HelpTopicConfig {
  return { id, label, ...extra };
}

/** Topics without wired Ask Aislix tools — hidden from the wizard. */
const UNAVAILABLE_TOPIC_IDS = new Set([
  "shelf_space",
  "shelf_stacking",
  "facing",
  "planogram",
  "pricing",
  "promotions",
  "brand_performance",
  "posm",
  "brand_visibility",
  "sales_rep_performance",
  "picking_accuracy",
  "putaway_accuracy",
  "receiving",
  "dispatch",
  "bin_accuracy",
  "location_compliance",
  "inventory_accuracy",
  "expiry_coverage",
  "cycle_count",
  "shelf_compliance",
  "putaway",
  "picking",
  "damage",
  "batch",
]);

export function getAvailableTopicsForRole(role: HelpOperatingRole): HelpTopicConfig[] {
  return TOPICS_BY_ROLE[role].filter(
    (t) => t.available !== false && !UNAVAILABLE_TOPIC_IDS.has(t.id),
  );
}

export const TOPICS_BY_ROLE: Record<HelpOperatingRole, HelpTopicConfig[]> = {
  supermarket: [
    topic("shelf_images", "Shelf Images", { groupByOptions: ["store"] }),
    topic("store_performance", "Store Performance", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("inventory", "Inventory", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("shelf_space", "Shelf Space", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "shelf", "aisle"], groupByOptions: ["store", "category", "brand"] }),
    topic("shelf_stacking", "Shelf Stacking", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "category"] }),
    topic("facing", "Facing", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "brand"] }),
    topic("planogram", "Planogram", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "category"] }),
    topic("product_availability", "Product Availability", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("oos", "OOS", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("expiry", "Expiry", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: STORE_GROUP }),
    topic("pricing", "Pricing", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "brand"] }),
    topic("promotions", "Promotions", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand"], groupByOptions: ["store", "brand"] }),
    topic("brand_performance", "Brand Performance", { needsProduct: true, needsGrouping: true, productDimensions: ["brand", "category"], groupByOptions: ["store", "brand", "category"] }),
    topic("findings", "Findings", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("corrective_actions", "Corrective Actions", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("audit_performance", "Audit Performance", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("evidence", "Evidence", { needsMetric: true, groupByOptions: ["store"] }),
    topic("other", "Other", { needsGrouping: true, groupByOptions: STORE_GROUP }),
  ],
  fmcg_distributor: [
    topic("outlet_performance", "Outlet Performance", { needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("distributor_performance", "Distributor Performance", { needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("stock_availability", "Stock Availability", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: FMCG_GROUP }),
    topic("oos", "OOS", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: FMCG_GROUP }),
    topic("sku_availability", "SKU Availability", { needsProduct: true, needsGrouping: true, productDimensions: ["sku", "brand", "category"], groupByOptions: FMCG_GROUP }),
    topic("brand_visibility", "Brand Visibility", { needsProduct: true, needsGrouping: true, productDimensions: ["brand", "category"], groupByOptions: FMCG_GROUP }),
    topic("shelf_execution", "Shelf Execution", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: FMCG_GROUP }),
    topic("planogram", "Planogram", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: FMCG_GROUP }),
    topic("pricing", "Pricing", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: FMCG_GROUP }),
    topic("promotions", "Promotions", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand"], groupByOptions: FMCG_GROUP }),
    topic("posm", "POSM", { needsProduct: true, needsGrouping: true, productDimensions: ["brand"], groupByOptions: FMCG_GROUP }),
    topic("expiry", "Expiry", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: FMCG_GROUP }),
    topic("outlet_compliance", "Outlet Compliance", { needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("sales_rep_performance", "Sales Rep / Beat Performance", { needsGrouping: true, groupByOptions: ["sales_rep", "beat", "outlet", "city"] }),
    topic("findings", "Findings", { needsMetric: true, needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("corrective_actions", "Corrective Actions", { needsMetric: true, needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("audit_performance", "Audit Performance", { needsMetric: true, needsGrouping: true, groupByOptions: FMCG_GROUP }),
    topic("other", "Other", { needsGrouping: true, groupByOptions: FMCG_GROUP }),
  ],
  local_store: [
    topic("shelf_images", "Shelf Images", { groupByOptions: ["store"] }),
    topic("store_performance", "Store Performance", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("inventory", "Inventory", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("stock_variance", "Stock Variance", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("product_availability", "Product Availability", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("oos", "OOS", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: STORE_GROUP }),
    topic("expiry", "Expiry", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: STORE_GROUP }),
    topic("shelf_stacking", "Shelf Stacking", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "category"] }),
    topic("shelf_compliance", "Shelf Compliance", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "category"] }),
    topic("pricing", "Pricing", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "brand"] }),
    topic("findings", "Findings", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("corrective_actions", "Corrective Actions", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("audit_performance", "Audit Performance", { needsMetric: true, needsGrouping: true, groupByOptions: STORE_GROUP }),
    topic("evidence", "Evidence", { needsMetric: true, groupByOptions: ["store"] }),
    topic("other", "Other", { needsGrouping: true, groupByOptions: STORE_GROUP }),
  ],
  dark_store: [
    topic("inventory_accuracy", "Inventory Accuracy", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "item_code"], groupByOptions: ["store", "zone", "sku"] }),
    topic("inventory_variance", "Inventory Variance", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "item_code"], groupByOptions: ["store", "zone", "sku"] }),
    topic("oos", "OOS", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "zone", "sku"] }),
    topic("expiry", "Expiry", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: ["store", "zone"] }),
    topic("expiry_coverage", "Expiry Coverage", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: ["store"] }),
    topic("picking_accuracy", "Picking Accuracy", { needsMetric: true, needsGrouping: true, groupByOptions: ["store", "zone", "sku", "day"] }),
    topic("putaway_accuracy", "Putaway Accuracy", { needsMetric: true, needsGrouping: true, groupByOptions: ["store", "zone", "day"] }),
    topic("receiving", "Receiving", { needsMetric: true, needsGrouping: true, groupByOptions: ["store", "day"] }),
    topic("damaged_inventory", "Damaged Inventory", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "zone"] }),
    topic("location_accuracy", "Shelf / Location Accuracy", { needsProduct: true, needsGrouping: true, productDimensions: ["zone", "sku"], groupByOptions: ["store", "zone"] }),
    topic("sku_performance", "SKU Performance", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: ["store", "sku"] }),
    topic("findings", "Findings", { needsMetric: true, needsGrouping: true, groupByOptions: ["store", "zone"] }),
    topic("corrective_actions", "Corrective Actions", { needsMetric: true, needsGrouping: true, groupByOptions: ["store"] }),
    topic("audit_performance", "Audit Performance", { needsMetric: true, needsGrouping: true, groupByOptions: ["store"] }),
    topic("evidence", "Evidence", { needsMetric: true, groupByOptions: ["store"] }),
    topic("other", "Other", { needsGrouping: true, groupByOptions: ["store", "zone"] }),
  ],
  warehouse: [
    topic("inventory_accuracy", "Inventory Accuracy", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "item_code"], groupByOptions: WAREHOUSE_GROUP }),
    topic("inventory_variance", "Inventory Variance", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "item_code"], groupByOptions: WAREHOUSE_GROUP }),
    topic("receiving", "Receiving", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("putaway", "Putaway", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("picking", "Picking", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("dispatch", "Dispatch", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("bin_accuracy", "Bin Accuracy", { needsProduct: true, needsGrouping: true, productDimensions: ["zone", "aisle", "rack", "bin", "sku"], groupByOptions: WAREHOUSE_GROUP }),
    topic("location_compliance", "Location Compliance", { needsProduct: true, needsGrouping: true, productDimensions: ["zone", "aisle", "rack", "bin"], groupByOptions: WAREHOUSE_GROUP }),
    topic("damage", "Damage", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: WAREHOUSE_GROUP }),
    topic("expiry", "Expiry", { needsProduct: true, needsMetric: true, needsGrouping: true, productDimensions: ["category", "brand", "sku", "batch"], groupByOptions: WAREHOUSE_GROUP }),
    topic("batch", "Batch", { needsProduct: true, needsGrouping: true, productDimensions: ["batch", "sku"], groupByOptions: WAREHOUSE_GROUP }),
    topic("cycle_count", "Cycle Count", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("sku_performance", "SKU Performance", { needsProduct: true, needsGrouping: true, productDimensions: ["category", "brand", "sku"], groupByOptions: WAREHOUSE_GROUP }),
    topic("findings", "Findings", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("corrective_actions", "Corrective Actions", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("audit_performance", "Audit Performance", { needsMetric: true, needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
    topic("evidence", "Evidence", { needsMetric: true, groupByOptions: ["warehouse"] }),
    topic("other", "Other", { needsGrouping: true, groupByOptions: WAREHOUSE_GROUP }),
  ],
};

export function metricsForTopic(topicId: string): HelpMetricOption[] {
  if (topicId === "findings") return FINDINGS_METRICS;
  if (topicId === "corrective_actions") return CA_METRICS;
  if (topicId === "audit_performance" || topicId === "evidence" || topicId === "shelf_images") {
    return AUDIT_METRICS;
  }
  if (
    topicId.includes("inventory") ||
    topicId === "stock_variance" ||
    topicId === "stock_availability" ||
    topicId === "oos" ||
    topicId === "product_availability" ||
    topicId === "sku_availability"
  ) {
    return INVENTORY_METRICS;
  }
  if (topicId.includes("expiry")) return EXPIRY_METRICS;
  if (topicId === "store_performance" || topicId === "outlet_performance") {
    return [
      { id: "audit_completion", label: "Audit Completion", available: true },
      { id: "open_findings", label: "Open Findings", available: true },
      { id: "value_variance", label: "Potential Inventory Value Variance", available: true },
    ];
  }
  return [
    { id: "audit_completion", label: "Audit Completion", available: true },
    { id: "open_findings", label: "Open Findings", available: true },
  ];
}

export const HELP_TIME_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "custom", label: "Custom date range" },
] as const;

export const HELP_LIMIT_OPTIONS = [
  { id: 5, label: "Top 5" },
  { id: 10, label: "Top 10" },
  { id: 0, label: "All" },
] as const;

export const GROUP_BY_LABELS: Record<string, string> = {
  store: "By Store",
  city: "By City",
  category: "By Category",
  brand: "By Brand",
  sku: "By SKU",
  product: "By Product",
  distributor: "By Distributor",
  outlet: "By Outlet",
  sales_rep: "By Sales Rep",
  beat: "By Beat",
  warehouse: "By Warehouse",
  zone: "By Zone",
  aisle: "By Aisle",
  rack: "By Rack",
  bin: "By Bin",
  day: "By Day",
  week: "By Week",
  month: "By Month",
};

export const PRODUCT_MODE_LABELS: Record<string, string> = {
  all: "All products",
  category: "Category",
  brand: "Brand",
  sku: "SKU",
  item_code: "Item Code",
  product_name: "Product Name",
  variant: "Variant",
  batch: "Batch",
};
