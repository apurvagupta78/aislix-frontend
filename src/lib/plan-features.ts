/**
 * Plan feature gates — backed by centralized plan entitlements.
 * Server also enforces via subscription_plans.entitlements (Supabase).
 */

import { planHasEntitlement, type PlanFeatureKey, type PlanId } from "@/lib/plan-entitlements";

export type PlanTier = "core" | "pro" | "enterprise";

/** @deprecated use PlanFeatureKey from plan-entitlements */
export type PlanFeature =
  | "financial_impact"
  | "competitor_intel"
  | "territory_analytics"
  | "historical_trends";

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  core: "Core",
  pro: "Pro",
  enterprise: "Enterprise",
};

const LEGACY_FEATURE_MAP: Record<PlanFeature, PlanFeatureKey> = {
  financial_impact: "commercial_impact",
  competitor_intel: "competition",
  territory_analytics: "store_benchmarking",
  historical_trends: "performance_trends",
};

export function planTier(planId?: string | null): PlanTier {
  const id = (planId ?? "free") as PlanId;
  if (id === "enterprise") return "enterprise";
  if (id === "growth" || id === "professional") return "pro";
  return "core";
}

/** Whether the workspace plan unlocks a product feature. Enterprise unlocks all. */
export function planHasFeature(planId: string | null | undefined, feature: PlanFeature): boolean {
  if (!planId) return false;
  return planHasEntitlement(planId, LEGACY_FEATURE_MAP[feature]);
}
/** Demo / marketing surfaces always show financial impact as a teaser. */
export function demoShowsFinancialImpact(): boolean {
  return true;
}
