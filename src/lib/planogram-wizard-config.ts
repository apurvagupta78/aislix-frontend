/**
 * New Planogram wizard — shared steps with role-specific visibility (Aislix spec §ROLE-WISE).
 */

import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { AuditKpiId } from "@/lib/role-kpi-config";

export type PlanogramWizardStepId =
  | "basics"
  | "fixture"
  | "products"
  | "layout"
  | "assortment"
  | "prices"
  | "promotions"
  | "role_settings"
  | "scoring"
  | "readiness";

export type PlanogramWizardStep = {
  id: PlanogramWizardStepId;
  label: string;
  description: string;
};

export const PLANOGRAM_WIZARD_STEPS: Record<PlanogramWizardStepId, PlanogramWizardStep> = {
  basics: {
    id: "basics",
    label: "Basic details",
    description: "Planogram name, audit role, store, fixture, category, validity, and timezone.",
  },
  fixture: {
    id: "fixture",
    label: "Fixture & shelves",
    description: "Physical rack dimensions and shelf structure for layout KPIs.",
  },
  products: {
    id: "products",
    label: "Products",
    description: "SKU catalog rows — brand, product, facings, and reference data for AI matching.",
  },
  layout: {
    id: "layout",
    label: "Shelf layout",
    description: "Location / slot IDs, expected facings, orientation, and placement per position.",
  },
  assortment: {
    id: "assortment",
    label: "Assortment & MSL",
    description: "Mandatory assortment and must-stock list (distributor MSL where applicable).",
  },
  prices: {
    id: "prices",
    label: "Prices",
    description: "Expected shelf prices, currency, label location, and validity dates.",
  },
  promotions: {
    id: "promotions",
    label: "Promotions",
    description: "Active promotions, signage, offer text, and required facings.",
  },
  role_settings: {
    id: "role_settings",
    label: "Role settings",
    description: "Share of shelf, pick locations, brand scope, or distributor portfolio — role-specific.",
  },
  scoring: {
    id: "scoring",
    label: "Scoring rules",
    description: "Configurable KPI targets and evidence thresholds for this planogram.",
  },
  readiness: {
    id: "readiness",
    label: "Readiness check",
    description: "Review which KPIs can be calculated before you scan or publish.",
  },
};

/** Step order per role — role at Step 1 controls which sections are required. */
const ROLE_WIZARD_ORDER: Record<AuditRoleTab, PlanogramWizardStepId[]> = {
  supermarket: [
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "scoring",
    "readiness",
  ],
  darkstore: [
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "role_settings",
    "scoring",
    "readiness",
  ],
  fmcg: [
    "basics",
    "fixture",
    "products",
    "layout",
    "promotions",
    "role_settings",
    "scoring",
    "readiness",
  ],
  distributor: [
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "role_settings",
    "scoring",
    "readiness",
  ],
  local: [
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "scoring",
    "readiness",
  ],
};

export function wizardStepsForRole(role: AuditRoleTab): PlanogramWizardStep[] {
  return ROLE_WIZARD_ORDER[role].map((id) => PLANOGRAM_WIZARD_STEPS[id]);
}

export function roleSettingsTitle(role: AuditRoleTab): string {
  switch (role) {
    case "darkstore":
      return "Dark store pick locations";
    case "fmcg":
      return "FMCG brand & Share of Shelf";
    case "distributor":
      return "Distributor portfolio & outlet MSL";
    default:
      return "Role-specific settings";
  }
}

export function roleSettingsHint(role: AuditRoleTab): string {
  switch (role) {
    case "darkstore":
      return "Ensure every product row has a shelf position / pick slot ID for Location Accuracy.";
    case "fmcg":
      return "Set primary brand and category scope — SOS uses all brands in the category as denominator.";
    case "distributor":
      return "MSL rows in Assortment step apply to this outlet; portfolio SKUs drive distributor KPIs.";
    default:
      return "";
  }
}

export function readinessKpisForRole(role: AuditRoleTab): AuditKpiId[] {
  return primaryKpiIds(role);
}
