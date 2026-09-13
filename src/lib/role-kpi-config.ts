/**
 * Role → five primary KPI definitions (mirrors backend app/role_kpi_config.py).
 */

import type { CustomerType } from "@/lib/customer-context";

export type AuditKpiId =
  | "osa"
  | "planogram_compliance"
  | "assortment_compliance"
  | "price_compliance"
  | "promotional_compliance"
  | "location_accuracy"
  | "facing_count"
  | "share_of_shelf"
  | "msl_compliance";

export type RoleKpiDefinition = {
  kpi_id: AuditKpiId;
  label: string;
  tooltip: string;
};

export type RoleProfile = {
  role_id: string;
  label: string;
  introduction: string;
  primary_kpis: RoleKpiDefinition[];
};

export const ROLE_PROFILES: Record<string, RoleProfile> = {
  supermarket: {
    role_id: "supermarket",
    label: "Supermarket",
    introduction:
      "Your shelf audit shows availability, placement, required products, pricing and promotional execution.",
    primary_kpis: [
      { kpi_id: "osa", label: "On-Shelf Availability (OSA)", tooltip: "Listed SKUs visibly available / assessed." },
      { kpi_id: "planogram_compliance", label: "Planogram Compliance", tooltip: "Positions passing layout checks / assessed." },
      { kpi_id: "assortment_compliance", label: "Assortment Compliance", tooltip: "Mandatory assortment SKUs present / assessed." },
      { kpi_id: "price_compliance", label: "Price Compliance", tooltip: "Price labels meeting approved requirements / assessed." },
      { kpi_id: "promotional_compliance", label: "Promotional Compliance", tooltip: "Active promotions passing visual checks / assessed." },
    ],
  },
  darkstore: {
    role_id: "darkstore",
    label: "Dark Store",
    introduction:
      "Your shelf audit shows what's available, what's in the right place, and where shelf execution needs attention.",
    primary_kpis: [
      { kpi_id: "osa", label: "On-Shelf Availability (OSA)", tooltip: "Listed SKUs visibly available / assessed." },
      { kpi_id: "location_accuracy", label: "Location Accuracy", tooltip: "Occupied locations with approved SKUs only / assessed." },
      { kpi_id: "planogram_compliance", label: "Planogram Compliance", tooltip: "Positions passing layout checks / assessed." },
      { kpi_id: "assortment_compliance", label: "Assortment Compliance", tooltip: "Mandatory assortment SKUs present / assessed." },
      { kpi_id: "facing_count", label: "Facing Count", tooltip: "Sum of visible front facings for assessed SKUs." },
    ],
  },
  fmcg: {
    role_id: "fmcg",
    label: "FMCG Brand",
    introduction:
      "Your shelf audit shows your brand's shelf presence, availability, facings, placement and promotional execution.",
    primary_kpis: [
      { kpi_id: "share_of_shelf", label: "Share of Shelf (SOS)", tooltip: "Brand linear shelf space / category total." },
      { kpi_id: "osa", label: "On-Shelf Availability (OSA)", tooltip: "Listed SKUs visibly available / assessed." },
      { kpi_id: "facing_count", label: "Facing Count", tooltip: "Visible front facings for the brand scope." },
      { kpi_id: "planogram_compliance", label: "Planogram Compliance", tooltip: "Positions passing layout checks / assessed." },
      { kpi_id: "promotional_compliance", label: "Promotional Compliance", tooltip: "Active promotions passing visual checks / assessed." },
    ],
  },
  distributor: {
    role_id: "distributor",
    label: "Distributor",
    introduction:
      "Your outlet audit shows availability, must-stock execution, shelf placement, pricing and promotions.",
    primary_kpis: [
      { kpi_id: "osa", label: "On-Shelf Availability (OSA)", tooltip: "Listed SKUs visibly available / assessed." },
      { kpi_id: "msl_compliance", label: "Must-Stock List (MSL)", tooltip: "Required MSL SKUs present / assessed." },
      { kpi_id: "planogram_compliance", label: "Planogram Compliance", tooltip: "Positions passing layout checks / assessed." },
      { kpi_id: "price_compliance", label: "Price Compliance", tooltip: "Price labels meeting approved requirements / assessed." },
      { kpi_id: "promotional_compliance", label: "Promotional Compliance", tooltip: "Active promotions passing visual checks / assessed." },
    ],
  },
  local: {
    role_id: "local",
    label: "Local Store",
    introduction:
      "Your shelf audit shows availability, required products, facings, pricing and promotions.",
    primary_kpis: [
      { kpi_id: "osa", label: "On-Shelf Availability (OSA)", tooltip: "Listed SKUs visibly available / assessed." },
      { kpi_id: "assortment_compliance", label: "Assortment Compliance", tooltip: "Mandatory assortment SKUs present / assessed." },
      { kpi_id: "facing_count", label: "Facing Count", tooltip: "Sum of visible front facings for assessed SKUs." },
      { kpi_id: "price_compliance", label: "Price Compliance", tooltip: "Price labels meeting approved requirements / assessed." },
      { kpi_id: "promotional_compliance", label: "Promotional Compliance", tooltip: "Active promotions passing visual checks / assessed." },
    ],
  },
};

export function normalizeRoleId(customerType?: CustomerType | string | null): string {
  const ct = (customerType ?? "supermarket").toLowerCase();
  const aliases: Record<string, string> = {
    fmcg_brand: "fmcg",
    brand: "fmcg",
    dark_store: "darkstore",
    kirana: "local",
    local_store: "local",
    audit_agency: "supermarket",
    warehouse: "darkstore",
  };
  const key = aliases[ct] ?? ct;
  return key in ROLE_PROFILES ? key : "supermarket";
}

export function getRoleProfile(customerType?: CustomerType | string | null): RoleProfile {
  return ROLE_PROFILES[normalizeRoleId(customerType)]!;
}
