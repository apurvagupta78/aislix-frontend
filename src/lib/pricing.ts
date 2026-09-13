/**
 * Pricing page exports — backed by centralized plan entitlements.
 * @see plan-entitlements.ts for the single source of truth.
 */

import {
  ANNUAL_DISCOUNT_PERCENT,
  annualBilledLabel,
  annualPriceFromMonthly,
  annualSavingInr,
  COMPARISON_GROUPS,
  displayPrice,
  formatInr,
  formatPrice,
  getPlanDefinition,
  planAuditLimitLabel,
  PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
  ENTERPRISE_PLAN,
  type BillingCycle,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plan-entitlements";

export type { BillingCycle, PlanId, PlanDefinition as Plan };
export {
  ANNUAL_DISCOUNT_PERCENT,
  annualBilledLabel,
  annualPriceFromMonthly,
  COMPARISON_GROUPS as comparisonGroups,
  displayPrice as priceFor,
  formatInr,
  formatPrice,
  getPlanDefinition as getPlan,
  planAuditLimitLabel,
  PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS as plans,
  ENTERPRISE_PLAN as enterprisePlan,
};

/** @deprecated use ANNUAL_DISCOUNT_PERCENT */
export const ANNUAL_MONTHS_BILLED = 10;

export function annualSaving(plan: PlanDefinition): number {
  return annualSavingInr(plan);
}

/** Legacy add-ons section removed from pricing — kept empty for importers. */
export const addOns: {
  id: string;
  name: string;
  description: string;
  priceInr: number | null;
  unit: string;
  available: boolean;
}[] = [];
