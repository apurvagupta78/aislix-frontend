import type {
  AuditPurpose,
  AuditSubjectType,
  OperatingModel,
} from "@/lib/audit-builder/types";

export type OperatingModelCard = {
  id: OperatingModel;
  title: string;
  description: string;
};

export type PurposeOption = {
  value: AuditPurpose;
  label: string;
  subjectType?: AuditSubjectType;
};

export const OPERATING_MODEL_CARDS: OperatingModelCard[] = [
  {
    id: "local_store",
    title: "Local Store",
    description: "Inventory, expiry, shelf, pricing and QC for kirana and small retail stores.",
  },
  {
    id: "supermarket",
    title: "Supermarket",
    description: "Shelf execution, planogram, pricing, promotion and department audits.",
  },
  {
    id: "dark_store",
    title: "Dark Store",
    description: "Inventory accuracy, expiry control, picking, putaway and location compliance.",
  },
  {
    id: "warehouse",
    title: "Warehouse",
    description: "Receiving, bin, putaway, picking, dispatch and storage compliance.",
  },
  {
    id: "fmcg_distributor",
    title: "FMCG / Distributor",
    description:
      "Audit distributors, outlets, availability, visibility, pricing, promotions, stock, expiry and retail execution.",
  },
  {
    id: "custom",
    title: "Custom",
    description: "Build a fully custom audit for any retail or field workflow.",
  },
];

export const FMCG_CHANNEL_TYPES = [
  "General Trade",
  "Modern Trade",
  "Supermarket",
  "Hypermarket",
  "Convenience Store",
  "Pharmacy",
  "HoReCa",
  "Kirana",
  "Wholesale",
  "E-commerce",
  "Quick Commerce",
  "Institutional",
  "Other",
] as const;

export const FMCG_OUTLET_TYPES = [
  "Kirana",
  "Grocery",
  "Supermarket",
  "Hypermarket",
  "Pharmacy",
  "Convenience Store",
  "Wholesale",
  "Cash & Carry",
  "Restaurant",
  "Café",
  "Hotel",
  "Institutional",
  "Online / E-commerce",
  "Dark Store",
  "Other",
] as const;

const PURPOSES_BY_MODEL: Record<OperatingModel, PurposeOption[]> = {
  local_store: [
    { value: "inventory", label: "Inventory Audit", subjectType: "sku" },
    { value: "expiry", label: "Expiry Audit", subjectType: "sku" },
    { value: "shelf", label: "Shelf Audit", subjectType: "shelf" },
    { value: "fnv_qc", label: "FNV / QC Audit", subjectType: "sku" },
    { value: "pricing", label: "Price Audit", subjectType: "sku" },
    { value: "outlet_visit", label: "Store Visit Audit", subjectType: "store" },
    { value: "custom", label: "Custom Local Store Audit", subjectType: "custom" },
  ],
  supermarket: [
    { value: "shelf", label: "Shelf Execution Audit", subjectType: "shelf" },
    { value: "planogram", label: "Planogram Compliance Audit", subjectType: "shelf" },
    { value: "inventory", label: "Inventory Accuracy Audit", subjectType: "sku" },
    { value: "expiry", label: "Expiry Audit", subjectType: "sku" },
    { value: "pricing", label: "Price Compliance Audit", subjectType: "sku" },
    { value: "promotion", label: "Promotion Audit", subjectType: "sku" },
    { value: "posm", label: "POSM / Visibility Audit", subjectType: "store" },
    { value: "fnv_qc", label: "FNV / QC Audit", subjectType: "sku" },
    { value: "competitor", label: "Competitor Audit", subjectType: "store" },
    { value: "custom", label: "Custom Supermarket Audit", subjectType: "custom" },
  ],
  dark_store: [
    { value: "inventory", label: "Inventory Accuracy Audit", subjectType: "sku" },
    { value: "expiry", label: "Expiry Control Audit", subjectType: "unit" },
    { value: "fnv_qc", label: "FNV / QC Audit", subjectType: "sku" },
    { value: "receiving", label: "Receiving Audit", subjectType: "shipment" },
    { value: "putaway", label: "Putaway Audit", subjectType: "bin" },
    { value: "picking", label: "Picking Accuracy Audit", subjectType: "sku" },
    { value: "shelf", label: "Shelf / Location Audit", subjectType: "shelf" },
    { value: "planogram", label: "Planogram / Shelf Execution Audit", subjectType: "shelf" },
    { value: "custom", label: "Custom Dark Store Audit", subjectType: "custom" },
  ],
  warehouse: [
    { value: "receiving", label: "Receiving QC Audit", subjectType: "shipment" },
    { value: "inventory", label: "Inventory Count Audit", subjectType: "bin" },
    { value: "putaway", label: "Putaway Audit", subjectType: "bin" },
    { value: "picking", label: "Picking Accuracy Audit", subjectType: "sku" },
    { value: "dispatch", label: "Dispatch Audit", subjectType: "order" },
    { value: "expiry", label: "Expiry Audit", subjectType: "batch" },
    { value: "custom", label: "Custom Warehouse Audit", subjectType: "custom" },
  ],
  fmcg_distributor: [
    { value: "retail_execution", label: "Outlet Retail Execution Audit", subjectType: "outlet" },
    { value: "outlet_visit", label: "Outlet Visit Audit", subjectType: "outlet" },
    { value: "availability", label: "Stock Availability Audit", subjectType: "sku" },
    { value: "oos", label: "OOS Audit", subjectType: "sku" },
    { value: "distributor", label: "Distributor Audit", subjectType: "distributor" },
    { value: "stock", label: "Distributor Stock Audit", subjectType: "sku" },
    { value: "expiry", label: "Expiry Audit", subjectType: "batch" },
    { value: "fnv_qc", label: "FNV / QC Audit", subjectType: "sku" },
    { value: "merchandising", label: "Merchandising Audit", subjectType: "sku" },
    { value: "visibility", label: "Shelf Visibility Audit", subjectType: "sku" },
    { value: "planogram", label: "Planogram Audit", subjectType: "shelf" },
    { value: "pricing", label: "Pricing Audit", subjectType: "sku" },
    { value: "promotion", label: "Promotion Compliance Audit", subjectType: "sku" },
    { value: "posm", label: "POSM Audit", subjectType: "outlet" },
    { value: "competitor", label: "Competitor Audit", subjectType: "outlet" },
    { value: "new_product_launch", label: "New Product Launch Audit", subjectType: "sku" },
    { value: "outlet_compliance", label: "Outlet Compliance Audit", subjectType: "outlet" },
    { value: "scheme_compliance", label: "Scheme Compliance Audit", subjectType: "outlet" },
    { value: "order_distribution", label: "Order / Distribution Audit", subjectType: "outlet" },
    { value: "custom", label: "Custom FMCG Audit", subjectType: "custom" },
  ],
  custom: [{ value: "custom", label: "Custom Audit", subjectType: "custom" }],
};

export const UNIVERSAL_RCA_OPTIONS = [
  "Stock Sold",
  "Damaged",
  "Expired",
  "Missing",
  "Misplaced",
  "Receiving Pending",
  "Counting Error",
  "System Inventory Incorrect",
  "Supplier Issue",
  "Distributor Issue",
  "Pricing Error",
  "Execution Error",
  "Planogram Error",
  "Promotion Error",
  "Other",
] as const;

export const STANDARD_FINDING_TYPES = [
  "Inventory Variance",
  "OOS",
  "Expired Product",
  "Near Expiry",
  "Damaged Product",
  "Wrong SKU",
  "Wrong Placement",
  "Planogram Violation",
  "Pricing Issue",
  "Promotion Non-Compliance",
  "POSM Missing",
  "Low Visibility",
  "Availability Issue",
  "QC Failure",
  "Receiving Variance",
  "Putaway Error",
  "Picking Error",
  "Dispatch Error",
  "Distributor Non-Compliance",
  "Competitor Issue",
  "Other",
] as const;

export function getPurposesForModel(model: OperatingModel): PurposeOption[] {
  return PURPOSES_BY_MODEL[model] ?? PURPOSES_BY_MODEL.custom;
}

export function getOperatingModelCard(model: OperatingModel): OperatingModelCard | undefined {
  return OPERATING_MODEL_CARDS.find((card) => card.id === model);
}

export type ContextualTerminology = {
  location: string;
  locationPlural: string;
  subLocation: string;
  productScope: string;
};

const TERMINOLOGY: Record<OperatingModel, ContextualTerminology> = {
  local_store: {
    location: "Store",
    locationPlural: "Stores",
    subLocation: "Shelf",
    productScope: "SKU",
  },
  supermarket: {
    location: "Store",
    locationPlural: "Stores",
    subLocation: "Aisle / Shelf",
    productScope: "SKU",
  },
  dark_store: {
    location: "Dark Store",
    locationPlural: "Dark Stores",
    subLocation: "Zone / Pick Face",
    productScope: "SKU",
  },
  warehouse: {
    location: "Warehouse",
    locationPlural: "Warehouses",
    subLocation: "Bin / Rack",
    productScope: "SKU / Batch",
  },
  fmcg_distributor: {
    location: "Outlet",
    locationPlural: "Outlets",
    subLocation: "Beat / Territory",
    productScope: "SKU",
  },
  custom: {
    location: "Location",
    locationPlural: "Locations",
    subLocation: "Area",
    productScope: "Product / SKU",
  },
};

export function getTerminology(model: OperatingModel): ContextualTerminology {
  return TERMINOLOGY[model] ?? TERMINOLOGY.custom;
}

export function getFmcgDimensions(model: OperatingModel): string[] {
  if (model !== "fmcg_distributor") return [];
  return [
    "Region",
    "Territory",
    "Area",
    "Distributor",
    "Sales Representative",
    "Beat",
    "Outlet",
    "Outlet Type",
    "Channel",
    "Category",
    "Brand",
    "SKU",
  ];
}
