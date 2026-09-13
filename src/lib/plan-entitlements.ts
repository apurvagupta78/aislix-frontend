/**
 * Versioned Aislix commercial catalogue — single source for pricing UI and client fallbacks.
 * Server enforcement must mirror these published new-customer limits.
 * Existing paid workspaces keep their contracted plan version until explicitly migrated.
 */

import type { CurrencyCode } from "@/lib/display-currency";
import { formatFromInr } from "@/lib/display-currency";

export const PLAN_CATALOGUE_VERSION = "2026.09.13-v3";

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
  supportingText?: string;
  /** Monthly price in INR rupees for display. null = custom / per-audit. */
  monthlyPriceInr: number | null;
  /** Integer paise. */
  monthlyPricePaise?: number;
  annualPricePaise?: number;
  perAuditPriceInr?: number;
  perAuditPricePaise?: number;
  periodLabel: string;
  controls: PlanControls;
  dailyScanLimit?: number | null;
  allowanceBullets: string[];
  features: string[];
  featureKeys: PlanFeatureKey[];
  cta: string;
  popular?: boolean;
  contactSales?: boolean;
  payAsYouGo?: boolean;
  historyDays: number | null;
  quotaPeriod: "month" | "month_and_day" | "pay_per_use";
  sortOrder: number;
};

/** Annual discount applied to Starter, Growth, and Professional. */
export const ANNUAL_DISCOUNT_PERCENT = 10;

export function annualPricePaiseFromMonthly(monthlyPaise: number): number {
  return Math.round(monthlyPaise * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
}

export function annualPriceFromMonthly(monthlyInr: number): number {
  return annualPricePaiseFromMonthly(Math.round(monthlyInr * 100)) / 100;
}

export function annualMonthlyEquivalent(annualInr: number): number {
  return annualInr / 12;
}

export function formatPaise(paise: number, currency: CurrencyCode = "INR"): string {
  const rupees = paise / 100;
  if (currency !== "INR") return formatFromInr(rupees, currency);
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Try Aislix on your own shelves. No credit card required.",
    supportingText: "No card required. Monthly and daily limits both apply.",
    monthlyPriceInr: 0,
    monthlyPricePaise: 0,
    periodLabel: "forever",
    controls: {
      audits: { value: 30, label: "AI scans", period: "month" },
      users: { value: 1, label: "Users" },
      stores: { value: 1, label: "Stores" },
      masterSetups: { value: 1, label: "Master setups" },
    },
    dailyScanLimit: 5,
    allowanceBullets: [
      "30 AI shelf scans per month",
      "Up to 5 scans per day",
      "1 user",
      "1 store",
      "1 master shelf setup",
      "30-day audit history",
    ],
    features: [
      "AI shelf photo audit",
      "Product and brand detection",
      "Visible product facings",
      "Visible shelf gaps and availability insights",
      "Basic shelf execution insights",
      "Annotated shelf image",
      "Planogram comparison with a configured reference",
      "Assortment checks with a configured product list",
      "Visible price and promotion checks",
      "Per-photo visible share of shelf",
      "Actionable issue summary",
      "PDF audit reports",
      "CSV export",
      "Aislix-branded reports and view-only share links",
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
      "share_of_shelf",
      "pdf_export",
      "csv_export",
      "public_share_links",
    ],
    cta: "Start Free",
    historyDays: 30,
    quotaPeriod: "month_and_day",
    sortOrder: 1,
  },
  {
    id: "payg",
    name: "Pay as You Go",
    description: "No subscription. Pay only for the shelf scans you need.",
    supportingText: "Prepaid credits are valid for 180 days. Credits are deducted only for completed scans.",
    monthlyPriceInr: null,
    perAuditPriceInr: 9,
    perAuditPricePaise: 900,
    periodLabel: "per completed AI scan",
    controls: {
      audits: { value: null, label: "Pay per completed scan" },
      users: { value: null, label: "Users" },
      stores: { value: null, label: "Stores" },
      masterSetups: { value: null, label: "Master setups" },
    },
    dailyScanLimit: null,
    allowanceBullets: [
      "No monthly subscription fee",
      "Buy 11 scans for ₹99",
      "Unlimited users",
      "Unlimited stores and outlets",
      "Unlimited self-service master setups",
      "90-day audit history",
    ],
    features: [
      "All core audit features in Free",
      "Product, brand, and facing analysis",
      "Availability and assortment checks",
      "Reference-based planogram comparison",
      "Visible price and promotion checks",
      "Per-photo visible share of shelf",
      "PDF and CSV reports",
      "Excel reports",
      "Shared team access",
      "Reports without promotional Aislix branding",
      "View-only shareable audit links",
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
      "share_of_shelf",
      "team_assignment",
      "audit_history",
      "pdf_export",
      "csv_export",
      "excel_export",
      "public_share_links",
    ],
    cta: "Buy Scan Credits",
    payAsYouGo: true,
    historyDays: 90,
    quotaPeriod: "pay_per_use",
    sortOrder: 2,
  },
  {
    id: "starter",
    name: "Starter",
    description: "For local stores and small retail teams building a regular audit habit.",
    supportingText: "Need more scans? Add 100 for ₹499 or upgrade.",
    monthlyPriceInr: 499,
    monthlyPricePaise: 49900,
    annualPricePaise: 538920,
    periodLabel: "/month",
    controls: {
      audits: { value: 150, label: "AI scans", period: "month" },
      users: { value: null, label: "Users" },
      stores: { value: null, label: "Stores" },
      masterSetups: { value: null, label: "Master setups" },
    },
    dailyScanLimit: null,
    allowanceBullets: [
      "150 AI shelf scans per month",
      "Unlimited users",
      "Unlimited stores and outlets",
      "Unlimited self-service master setups",
      "12-month audit history",
    ],
    features: [
      "Everything in Pay As You Go",
      "Dashboard analytics",
      "Store performance overview",
      "Compare audits and store visits",
      "Team assignments",
      "Issue ownership and priority tracking",
      "PDF, CSV, and Excel reports",
      "Email reports",
      "Shareable audit links",
      "Searchable store and audit history",
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
    historyDays: 365,
    quotaPeriod: "month",
    sortOrder: 3,
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing retail chains, distributors, and field teams.",
    supportingText: "Need more scans? Add 100 for ₹399 or upgrade.",
    monthlyPriceInr: 1499,
    monthlyPricePaise: 149900,
    annualPricePaise: 1618920,
    periodLabel: "/month",
    controls: {
      audits: { value: 500, label: "AI scans", period: "month" },
      users: { value: null, label: "Users" },
      stores: { value: null, label: "Stores" },
      masterSetups: { value: null, label: "Master setups" },
    },
    dailyScanLimit: null,
    allowanceBullets: [
      "500 AI shelf scans per month",
      "Unlimited users",
      "Unlimited stores and outlets",
      "Unlimited self-service master setups",
      "24-month audit history",
    ],
    features: [
      "Everything in Starter",
      "Advanced shelf analytics",
      "Performance trends",
      "Store and team benchmarking",
      "Aggregated brand analysis",
      "Share-of-shelf analysis",
      "Visible competitor comparison",
      "Configurable commercial-impact estimates",
      "Historical improvement tracking",
      "Issue-resolution tracking",
      "Before-and-after corrective-action comparisons",
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
    historyDays: 730,
    quotaPeriod: "month",
    sortOrder: 4,
  },
  {
    id: "professional",
    name: "Professional",
    description: "For supermarkets, dark stores, FMCG brands, and larger retail operations.",
    supportingText: "Need more scans? Add 500 for ₹1,499.",
    monthlyPriceInr: 4999,
    monthlyPricePaise: 499900,
    annualPricePaise: 5398920,
    periodLabel: "/month",
    controls: {
      audits: { value: 2000, label: "AI scans", period: "month" },
      users: { value: null, label: "Users" },
      stores: { value: null, label: "Stores" },
      masterSetups: { value: null, label: "Master setups" },
    },
    dailyScanLimit: null,
    allowanceBullets: [
      "2,000 AI shelf scans per month",
      "Unlimited users",
      "Unlimited stores and outlets",
      "Unlimited self-service master setups",
      "36-month audit history",
    ],
    features: [
      "Everything in Growth",
      "Consolidated multi-store analytics",
      "City and country benchmarking",
      "Territory performance analysis",
      "Advanced brand analysis",
      "Share-of-shelf trends",
      "Shelf position and facing-change insights",
      "Advanced issue analytics",
      "Commercial-impact estimate dashboards",
      "Long-term historical performance trends",
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
    cta: "Start with Professional",
    historyDays: 1095,
    quotaPeriod: "month",
    sortOrder: 5,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "For large-scale deployments and organisations with custom implementation, security, or integration requirements.",
    supportingText:
      "Implementation, integrations, dedicated support, and custom requirements are quoted separately.",
    monthlyPriceInr: 19999,
    monthlyPricePaise: 1999900,
    periodLabel: "/month",
    controls: {
      audits: { value: 8000, label: "AI scans", period: "month" },
      users: { value: null, label: "Users" },
      stores: { value: null, label: "Stores" },
      masterSetups: { value: null, label: "Master setups" },
    },
    dailyScanLimit: null,
    allowanceBullets: [
      "8,000 AI shelf scans per month in the starting package",
      "Unlimited users",
      "Unlimited stores and outlets",
      "Unlimited self-service master setups",
      "36-month standard audit history",
    ],
    features: [
      "Everything in Professional",
      "Custom rollout planning",
      "Higher-volume scan packages",
      "Integration requirements scoped to your systems",
      "Security and administration requirements reviewed with your team",
      "Optional assisted onboarding and implementation",
      "Optional contractual support and SLA arrangements",
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
    historyDays: 1095,
    quotaPeriod: "month",
    sortOrder: 6,
  },
];

export const SUBSCRIPTION_PLANS = PLAN_DEFINITIONS.filter((p) => p.id !== "enterprise");
export const ENTERPRISE_PLAN = PLAN_DEFINITIONS.find((p) => p.id === "enterprise")!;

export function getPlanDefinition(id?: string | null): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.id === id);
}

export function planAuditLimitLabel(plan: PlanDefinition): string {
  const { audits } = plan.controls;
  if (plan.payAsYouGo) return "Pay per completed AI scan";
  if (plan.id === "free") return "30 AI scans / month · up to 5 / day";
  if (audits.value === null) return "Custom AI scan volume";
  return `${audits.value.toLocaleString("en-IN")} AI scans / month`;
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
  if (plan.contactSales && plan.monthlyPriceInr != null) {
    return `From ${formatPrice(plan.monthlyPriceInr, currency)}`;
  }
  if (plan.contactSales) return "Custom";
  if (plan.payAsYouGo && plan.perAuditPriceInr != null) {
    return formatPrice(plan.perAuditPriceInr, currency);
  }
  if (plan.monthlyPriceInr === null) return "Custom";
  if (plan.monthlyPriceInr === 0) return formatPrice(0, currency);
  if (cycle === "monthly") return formatPrice(plan.monthlyPriceInr, currency);
  const annualPaise = plan.annualPricePaise ?? annualPricePaiseFromMonthly(plan.monthlyPricePaise ?? plan.monthlyPriceInr * 100);
  return formatPaise(Math.round(annualPaise / 12), currency);
}

export function annualBilledLabel(plan: PlanDefinition, currency: CurrencyCode = "INR"): string | null {
  if (!plan.monthlyPriceInr || plan.payAsYouGo || plan.contactSales) return null;
  const annualPaise = plan.annualPricePaise ?? annualPricePaiseFromMonthly(plan.monthlyPricePaise ?? plan.monthlyPriceInr * 100);
  return `Billed ${formatPaise(annualPaise, currency)} annually`;
}

export function annualSavingInr(plan: PlanDefinition): number {
  if (!plan.monthlyPriceInr || plan.payAsYouGo) return 0;
  const annualPaise = plan.annualPricePaise ?? annualPricePaiseFromMonthly(plan.monthlyPricePaise ?? plan.monthlyPriceInr * 100);
  return plan.monthlyPriceInr * 12 - annualPaise / 100;
}

export function planHasEntitlement(planId: PlanId | string | null | undefined, key: PlanFeatureKey): boolean {
  if (!planId) return false;
  if (planId === "enterprise") return true;
  const plan = getPlanDefinition(planId);
  return plan?.featureKeys.includes(key) ?? false;
}

export type ComparisonCell = string | boolean;

export const COMPARISON_GROUPS: {
  group: string;
  rows: { label: string; values: Record<PlanId, ComparisonCell> }[];
}[] = [
  {
    group: "Pricing and billing",
    rows: [
      { label: "Monthly price", values: { free: "₹0", payg: "₹9 / scan", starter: "₹499", growth: "₹1,499", professional: "₹4,999", enterprise: "From ₹19,999" } },
      { label: "Annual (10% off)", values: { free: "—", payg: "—", starter: "₹5,389.20", growth: "₹16,189.20", professional: "₹53,989.20", enterprise: "Quoted" } },
    ],
  },
  {
    group: "Scan allowances",
    rows: [
      { label: "Included AI scans", values: { free: "30 / month", payg: "Prepaid credits", starter: "150 / month", growth: "500 / month", professional: "2,000 / month", enterprise: "8,000 starting" } },
      { label: "Daily commercial limit", values: { free: "5 / day", payg: "None", starter: "None", growth: "None", professional: "None", enterprise: "None" } },
    ],
  },
  {
    group: "Users / stores / master setups",
    rows: [
      { label: "Users", values: { free: "1", payg: "Unlimited", starter: "Unlimited", growth: "Unlimited", professional: "Unlimited", enterprise: "Unlimited" } },
      { label: "Stores", values: { free: "1", payg: "Unlimited", starter: "Unlimited", growth: "Unlimited", professional: "Unlimited", enterprise: "Unlimited" } },
      { label: "Master Shelf Setups", values: { free: "1", payg: "Unlimited", starter: "Unlimited", growth: "Unlimited", professional: "Unlimited", enterprise: "Unlimited" } },
    ],
  },
  {
    group: "Core intelligence",
    rows: [
      { label: "AI Shelf Audit", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Product Detection", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Brand Detection", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "OSA", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Facings", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Planogram", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Assortment", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Price", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Promotion", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Analytics",
    rows: [
      { label: "Shelf Health", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Share of Shelf", values: { free: "Per photo", payg: "Per photo", starter: "Per photo", growth: true, professional: true, enterprise: true } },
      { label: "Competition", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Performance Trends", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
      { label: "Store Benchmarking", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Issue Analytics", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Commercial Impact", values: { free: false, payg: false, starter: false, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Team workflows",
    rows: [
      { label: "Audit Assignment", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Issue Tracking", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Public Share Links", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Reports and exports",
    rows: [
      { label: "PDF", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "CSV", values: { free: true, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Excel", values: { free: false, payg: true, starter: true, growth: true, professional: true, enterprise: true } },
      { label: "Email Reports", values: { free: false, payg: false, starter: true, growth: true, professional: true, enterprise: true } },
    ],
  },
  {
    group: "Retention",
    rows: [
      { label: "Audit History", values: { free: "30 days", payg: "90 days", starter: "12 months", growth: "24 months", professional: "36 months", enterprise: "36 months" } },
    ],
  },
  {
    group: "Enterprise services",
    rows: [
      { label: "API", values: { free: false, payg: false, starter: false, growth: false, professional: true, enterprise: "By agreement" } },
      { label: "Custom implementation", values: { free: false, payg: false, starter: false, growth: false, professional: false, enterprise: "Quoted" } },
    ],
  },
];
