/**
 * Central Aislix plan catalogue — single source for pricing UI and client fallbacks.
 * Server enforcement mirrors these limits in `subscription_plans` (Supabase migration).
 */

import type { CurrencyCode } from "@/lib/display-currency";
import { formatFromInr } from "@/lib/display-currency";

export type PlanId =
  | "free"
  | "payg"
  | "starter"
  | "growth"
  | "professional"
  | "enterprise";

export type BillingCycle = "monthly" | "annual";

export type PlanFeatureKey =
  | "ai_shelf_audit"
  | "product_detection"
  | "brand_detection"
  | "osa"
  | "facings"
  | "planogram"
  | "assortment"
  | "price_compliance"
  | "promotion"
  | "shelf_health"
  | "share_of_shelf"
  | "competition"
  | "performance_trends"
  | "store_benchmarking"
  | "issue_analytics"
  | "commercial_impact"
  | "team_assignment"
  | "audit_history"
  | "rescan_verification"
  | "issue_tracking"
  | "public_share_links"
  | "pdf_export"
  | "csv_export"
  | "excel_export"
  | "email_reports"
  | "api_access"
  | "enterprise_integrations";

export type PlanControls = {
  audits: { value: number | null; label: string; period?: string };
  users: { value: number | null; label: string };
  stores: { value: number | null; label: string };
  masterSetups: { value: number | null; label: string };
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  /** Monthly price in INR. null = custom / per-audit. */
  monthlyPriceInr: number | null;
  /** Per completed AI audit (PAYG only). */
  perAuditPriceInr?: number;
  periodLabel: string;
  controls: PlanControls;
  features: string[];
  featureKeys: PlanFeatureKey[];
  cta: string;
  popular?: boolean;
  contactSales?: boolean;
  payAsYouGo?: boolean;
  historyDays: number | null;
  quotaPeriod: "month" | "rolling_24h" | "pay_per_use";
  sortOrder: number;
};

/** Annual discount — billed as 10 months of monthly price (≈17% saving). */
export const ANNUAL_DISCOUNT_PERCENT = 17;

export function annualPriceFromMonthly(monthlyInr: number): number {
  return Math.round(monthlyInr * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
}

export function annualMonthlyEquivalent(annualInr: number): number {
  return Math.round(annualInr / 12);
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Try Aislix before you commit.",
    monthlyPriceInr: 0,
    periodLabel: "/ month",
    controls: {
      audits: { value: 5, label: "AI audits", period: "24 hours" },
      users: { value: 1, label: "Users" },
      stores: { value: 1, label: "Stores" },
      masterSetups: { value: 1, label: "Master setups" },
    },
    features: [
      "AI shelf audit",
      "Product & brand detection",
      "On-shelf availability",
      "Basic shelf execution insights",
      "Annotated shelf image",
      "PDF audit report",
      "CSV export",
      "7-day audit history",
      "Demo role dashboards",
      "No credit card required",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "pdf_export",
      "csv_export",
    ],
    cta: "Start Free",
    historyDays: 7,
    quotaPeriod: "rolling_24h",
    sortOrder: 1,
  },
  {
    id: "payg",
    name: "Pay as You Go",
    description: "No monthly commitment. Pay only when you run an audit.",
    monthlyPriceInr: null,
    perAuditPriceInr: 29,
    periodLabel: "/ completed AI audit",
    controls: {
      audits: { value: null, label: "Pay per completed audit" },
      users: { value: 3, label: "Users" },
      stores: { value: 3, label: "Stores" },
      masterSetups: { value: 3, label: "Master setups" },
    },
    features: [
      "Everything needed for a real shelf audit",
      "Master shelf setup",
      "Planogram comparison",
      "Product & brand analysis",
      "Availability & assortment",
      "Price & promotion checks",
      "Audit history",
      "PDF & CSV reports",
      "Excel reports",
      "Team assignment",
      "Audit sharing",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "facings",
      "planogram",
      "assortment",
      "price_compliance",
      "promotion",
      "team_assignment",
      "audit_history",
      "pdf_export",
      "csv_export",
      "excel_export",
      "public_share_links",
    ],
    cta: "Start Paying as You Go",
    payAsYouGo: true,
    historyDays: null,
    quotaPeriod: "pay_per_use",
    sortOrder: 2,
  },
  {
    id: "starter",
    name: "Starter",
    description: "For local stores and small retail teams.",
    monthlyPriceInr: 999,
    periodLabel: "/ month",
    controls: {
      audits: { value: 300, label: "AI audits", period: "month" },
      users: { value: 3, label: "Users" },
      stores: { value: 3, label: "Stores" },
      masterSetups: { value: 5, label: "Master setups" },
    },
    features: [
      "Everything in Pay as You Go",
      "Unlimited audit history",
      "Dashboard analytics",
      "Store performance",
      "Team assignments",
      "Compare audits",
      "PDF, CSV & Excel reports",
      "Email reports",
      "Shareable audit links",
      "Priority issue tracking",
      "Email support",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "facings",
      "planogram",
      "assortment",
      "price_compliance",
      "promotion",
      "shelf_health",
      "team_assignment",
      "audit_history",
      "issue_tracking",
      "public_share_links",
      "pdf_export",
      "csv_export",
      "excel_export",
      "email_reports",
    ],
    cta: "Start with Starter",
    historyDays: null,
    quotaPeriod: "month",
    sortOrder: 3,
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing retail chains, distributors and field teams.",
    monthlyPriceInr: 2499,
    periodLabel: "/ month",
    controls: {
      audits: { value: 1500, label: "AI audits", period: "month" },
      users: { value: 10, label: "Users" },
      stores: { value: 10, label: "Stores" },
      masterSetups: { value: 25, label: "Master setups" },
    },
    features: [
      "Everything in Starter",
      "Advanced shelf analytics",
      "Performance trends",
      "Store & team benchmarking",
      "Brand Analysis",
      "Share of Shelf",
      "Competitor analysis",
      "Commercial Impact estimates",
      "Historical improvement tracking",
      "Issue resolution tracking",
      "Role-specific dashboards",
      "Team audit assignment",
      "Priority support",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "facings",
      "planogram",
      "assortment",
      "price_compliance",
      "promotion",
      "shelf_health",
      "share_of_shelf",
      "competition",
      "performance_trends",
      "store_benchmarking",
      "issue_analytics",
      "commercial_impact",
      "team_assignment",
      "audit_history",
      "rescan_verification",
      "issue_tracking",
      "public_share_links",
      "pdf_export",
      "csv_export",
      "excel_export",
      "email_reports",
    ],
    cta: "Start with Growth",
    popular: true,
    historyDays: null,
    quotaPeriod: "month",
    sortOrder: 4,
  },
  {
    id: "professional",
    name: "Professional",
    description: "For supermarkets, dark stores, FMCG brands and larger retail teams.",
    monthlyPriceInr: 4999,
    periodLabel: "/ month",
    controls: {
      audits: { value: 5000, label: "AI audits", period: "month" },
      users: { value: 25, label: "Users" },
      stores: { value: 25, label: "Stores" },
      masterSetups: { value: 100, label: "Master setups" },
    },
    features: [
      "Everything in Growth",
      "Multi-store analytics",
      "City & country benchmarking",
      "Territory performance",
      "Advanced Brand Analysis",
      "Share of Shelf trends",
      "Product movement insights",
      "Advanced issue analytics",
      "Commercial Impact analytics",
      "Historical performance trends",
      "Excel/PDF/CSV exports",
      "REST API access",
      "Faster processing",
      "Priority support",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "facings",
      "planogram",
      "assortment",
      "price_compliance",
      "promotion",
      "shelf_health",
      "share_of_shelf",
      "competition",
      "performance_trends",
      "store_benchmarking",
      "issue_analytics",
      "commercial_impact",
      "team_assignment",
      "audit_history",
      "rescan_verification",
      "issue_tracking",
      "public_share_links",
      "pdf_export",
      "csv_export",
      "excel_export",
      "email_reports",
      "api_access",
    ],
    cta: "Start Professional",
    historyDays: null,
    quotaPeriod: "month",
    sortOrder: 5,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "For national retail networks, FMCG organizations and large distributor operations.",
    monthlyPriceInr: null,
    periodLabel: "",
    controls: {
      audits: { value: null, label: "Custom AI audit volume" },
      users: { value: null, label: "Custom users" },
      stores: { value: null, label: "Custom stores" },
      masterSetups: { value: null, label: "Custom master setups" },
    },
    features: [
      "Everything in Professional",
      "Multi-location workspace",
      "Advanced permissions",
      "SSO / enterprise authentication",
      "API integrations",
      "Custom KPI configuration",
      "Custom AI/model requirements",
      "Custom reporting",
      "Dedicated onboarding",
      "SLA & support",
      "Dedicated account management",
      "Custom security requirements",
    ],
    featureKeys: [
      "ai_shelf_audit",
      "product_detection",
      "brand_detection",
      "osa",
      "facings",
      "planogram",
      "assortment",
      "price_compliance",
      "promotion",
      "shelf_health",
      "share_of_shelf",
      "competition",
      "performance_trends",
      "store_benchmarking",
      "issue_analytics",
      "commercial_impact",
      "team_assignment",
      "audit_history",
      "rescan_verification",
      "issue_tracking",
      "public_share_links",
      "pdf_export",
      "csv_export",
      "excel_export",
      "email_reports",
      "api_access",
      "enterprise_integrations",
    ],
    cta: "Talk to Sales",
    contactSales: true,
    historyDays: null,
    quotaPeriod: "month",
    sortOrder: 6,
  },
];

export const SUBSCRIPTION_PLANS = PLAN_DEFINITIONS.filter((p) => p.id !== "enterprise");
export const ENTERPRISE_PLAN = PLAN_DEFINITIONS.find((p) => p.id === "enterprise")!;

export function getPlanDefinition(id?: string | null): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.id === id);
}

/** One-line audit allowance for billing / plan summaries. */
export function planAuditLimitLabel(plan: PlanDefinition): string {
  const { audits } = plan.controls;
  if (plan.payAsYouGo) return "Pay per completed AI audit";
  if (audits.value === null) return "Custom AI audit volume";
  if (plan.quotaPeriod === "rolling_24h") {
    return `${audits.value} AI audits / 24 hours`;
  }
  return `${audits.value.toLocaleString("en-IN")} AI audits / month`;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatPrice(amountInr: number, currency: CurrencyCode = "INR"): string {
  return formatFromInr(amountInr, currency);
}

export function displayPrice(
  plan: PlanDefinition,
  cycle: BillingCycle,
  currency: CurrencyCode = "INR",
): string {
  if (plan.contactSales) return "Custom";
  if (plan.payAsYouGo && plan.perAuditPriceInr != null) {
    return formatPrice(plan.perAuditPriceInr, currency);
  }
  if (plan.monthlyPriceInr === null) return "Custom";
  if (plan.monthlyPriceInr === 0) return formatPrice(0, currency);
  if (cycle === "monthly") return formatPrice(plan.monthlyPriceInr, currency);
  const annual = annualPriceFromMonthly(plan.monthlyPriceInr);
  return formatPrice(annualMonthlyEquivalent(annual), currency);
}

export function annualSavingInr(plan: PlanDefinition): number {
  if (!plan.monthlyPriceInr || plan.payAsYouGo) return 0;
  return plan.monthlyPriceInr * 12 - annualPriceFromMonthly(plan.monthlyPriceInr);
}

export function planHasEntitlement(planId: PlanId | string | null | undefined, key: PlanFeatureKey): boolean {
  if (!planId) return false;
  if (planId === "enterprise") return true;
  const plan = getPlanDefinition(planId);
  return plan?.featureKeys.includes(key) ?? false;
}

/** Comparison matrix groups for the pricing page. */
export type ComparisonCell = string | boolean;

export const COMPARISON_GROUPS: {
  group: string;
  rows: { label: string; values: Record<PlanId, ComparisonCell> }[];
}[] = [
  {
    group: "Audit",
    rows: [
      { label: "AI Shelf Audit", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Product Detection", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Brand Detection", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "OSA", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Facings", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Planogram", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Assortment", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Price", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Promotion", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Intelligence",
    rows: [
      { label: "Shelf Health", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Share of Shelf", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Competition", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Performance Trends", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Store Benchmarking", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Issue Analytics", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Commercial Impact", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Workflow",
    rows: [
      { label: "Audit Assignment", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Team Members", values: { free: "1", payg: "3", starter: "3", growth: "10", professional: "25", enterprise: "Custom" } },
      { label: "Audit History", values: { free: "7 days", payg: true, starter: "Unlimited", growth: "Unlimited", professional: "Unlimited", enterprise: "Unlimited" } },
      { label: "Rescan & Verification", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Issue Tracking", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Public Share Links", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Reports",
    rows: [
      { label: "PDF", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "CSV", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Excel", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Email Reports", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Scale",
    rows: [
      { label: "AI Audits", values: { free: "5 / 24h", payg: "Pay per audit", starter: "300 / mo", growth: "1,500 / mo", professional: "5,000 / mo", enterprise: "Custom" } },
      { label: "Users", values: { free: "1", payg: "3", starter: "3", growth: "10", professional: "25", enterprise: "Custom" } },
      { label: "Stores", values: { free: "1", payg: "3", starter: "3", growth: "10", professional: "25", enterprise: "Custom" } },
      { label: "Master Shelf Setups", values: { free: "1", payg: "3", starter: "5", growth: "25", professional: "100", enterprise: "Custom" } },
      { label: "API", values: { free: false, payg: false, starter: false, growth: false, professional: true, enterprise: true } },
      { label: "Enterprise Integrations", values: { free: false, payg: false, starter: false, growth: false, professional: false, enterprise: true } },
    ],
  },
];
