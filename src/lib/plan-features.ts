/**
 * Plan feature gates — Core / Pro / Enterprise packaging.
 * Core = Free + Starter · Pro = Growth + Professional · Enterprise = Enterprise
 */

import { type PlanId } from "@/lib/pricing";

export type PlanTier = "core" | "pro" | "enterprise";

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

const FEATURE_PLANS: Record<PlanFeature, readonly PlanId[]> = {
  financial_impact: ["growth", "professional", "enterprise"],
  competitor_intel: ["growth", "professional", "enterprise"],
  territory_analytics: ["professional", "enterprise"],
  historical_trends: ["growth", "professional", "enterprise"],
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
  if (planId === "enterprise") return true;
  return FEATURE_PLANS[feature].includes(planId as PlanId);
}

/** Demo / marketing surfaces always show financial impact as a teaser. */
export function demoShowsFinancialImpact(): boolean {
  return true;
}
