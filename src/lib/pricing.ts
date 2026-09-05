// Aislix plan catalogue. This is product configuration (not scan data), so it
// is defined statically here and consumed by both /pricing and /billing.
// Prices are in INR. Annual pricing = 10 months (≈17% saving).
//
// Limits mirror the `subscription_plans` table exactly:
//   free         ₹0      5 scans / rolling 24h   1 store   7-day history
//   starter      ₹999    300 scans / month       1 store
//   growth       ₹2,999  3,000 scans / month     3 stores
//   professional ₹4,999  5,000 scans / month     5 stores
//   enterprise   Custom  unlimited               unlimited

import { formatFromInr, type CurrencyCode } from "@/lib/display-currency";

export type PlanId = "free" | "starter" | "growth" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in INR. `null` = quote-based (Enterprise). */
  monthlyPrice: number | null;
  /** Annual price in INR, billed yearly. `null` = quote-based. */
  annualPrice: number | null;
  scanLimitLabel: string;
  /** Included scans per period; null = unlimited/quote-based. */
  monthlyScanQuota: number | null;
  /** Stores included; null = unlimited. */
  storeLimit: number | null;
  /** Team users included (owner counts as 1); null = unlimited. */
  seatLimit: number | null;
  /** Visible scan-history window in days; null = unlimited. */
  historyDays: number | null;
  features: string[];
  cta: string;
  popular?: boolean;
  contactSales?: boolean;
};

export const ANNUAL_MONTHS_BILLED = 10;

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For single-store owners trying shelf audits",
    monthlyPrice: 0,
    annualPrice: 0,
    scanLimitLabel: "5 scans per 24 hours",
    monthlyScanQuota: 5,
    storeLimit: 1,
    seatLimit: 1,
    historyDays: 7,
    features: [
      "5 scans per 24 hours",
      "1 store",
      "1 user",
      "AI product detection",
      "Annotated shelf image",
      "PDF audit report",
      "Basic dashboard analytics",
      "Scan history (last 7 days)",
    ],
    cta: "Start free",
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For local stores and boutique retail chains",
    monthlyPrice: 999,
    annualPrice: 999 * ANNUAL_MONTHS_BILLED,
    scanLimitLabel: "300 scans per month",
    monthlyScanQuota: 300,
    storeLimit: 1,
    seatLimit: 1,
    historyDays: null,
    features: [
      "300 scans per month",
      "1 store",
      "1 user",
      "Multi-image upload",
      "AI shelf audit",
      "Annotated shelf image",
      "PDF & CSV reports",
      "Unlimited scan history",
      "Dashboard analytics",
      "Email support",
    ],
    cta: "Upgrade to Starter",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing retail chains and distributors",
    monthlyPrice: 2999,
    annualPrice: 2999 * ANNUAL_MONTHS_BILLED,
    scanLimitLabel: "3,000 scans per month",
    monthlyScanQuota: 3000,
    storeLimit: 3,
    seatLimit: 3,
    historyDays: null,
    features: [
      "3,000 scans per month",
      "Up to 3 stores",
      "Up to 3 team users",
      "Multi-image upload",
      "Advanced shelf analytics",
      "Historical trends",
      "PDF & CSV reports",
      "Unlimited scan history",
      "Email support",
    ],
    cta: "Upgrade to Growth",
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For supermarkets, dark stores and retail chains",
    monthlyPrice: 4999,
    annualPrice: 4999 * ANNUAL_MONTHS_BILLED,
    scanLimitLabel: "5,000 scans per month",
    monthlyScanQuota: 5000,
    storeLimit: 5,
    seatLimit: 5,
    historyDays: null,
    features: [
      "5,000 scans per month",
      "Up to 5 stores",
      "Up to 5 team users",
      "Unlimited images per scan",
      "Faster AI processing",
      "Advanced shelf analytics",
      "Historical trends",
      "Product movement insights",
      "Low stock alerts",
      "Priority support",
      "REST API access",
    ],
    cta: "Upgrade to Professional",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For multi-location retail groups and national brands",
    monthlyPrice: null,
    annualPrice: null,
    scanLimitLabel: "Unlimited scans, stores & users",
    monthlyScanQuota: null,
    storeLimit: null,
    seatLimit: null,
    historyDays: null,
    features: [
      "Unlimited scans",
      "Unlimited users",
      "Unlimited stores",
      "Multi-location dashboard",
      "Custom AI models",
      "Custom integrations",
      "SLA",
      "Dedicated account manager",
      "On-premise deployment (future)",
      "White-label solution (future)",
    ],
    cta: "Contact sales",
    contactSales: true,
  },
];

export function getPlan(id?: string | null): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Formats an INR amount in the visitor's display currency. */
export function formatPrice(amountInr: number, currency: CurrencyCode = "INR"): string {
  return formatFromInr(amountInr, currency);
}

export function priceFor(
  plan: Plan,
  cycle: BillingCycle,
  currency: CurrencyCode = "INR",
): string {
  if (plan.monthlyPrice === null) return "Custom";
  if (plan.monthlyPrice === 0) return formatPrice(0, currency);
  if (cycle === "monthly") return formatPrice(plan.monthlyPrice, currency);
  return formatPrice(Math.round((plan.annualPrice ?? 0) / 12), currency);
}

export function annualSaving(plan: Plan): number {
  if (!plan.monthlyPrice || plan.annualPrice === null) return 0;
  return plan.monthlyPrice * 12 - plan.annualPrice;
}

/** Feature comparison matrix for the pricing table. */
export const comparisonGroups: {
  group: string;
  rows: { label: string; values: Record<PlanId, string | boolean> }[];
}[] = [
  {
    group: "Scanning",
    rows: [
      {
        label: "Scans included",
        values: {
          free: "5 / 24 hours",
          starter: "300 / month",
          growth: "3,000 / month",
          professional: "5,000 / month",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Stores included",
        values: { free: "1", starter: "1", growth: "3", professional: "5", enterprise: "Unlimited" },
      },
      {
        label: "Images per scan",
        values: {
          free: "1",
          starter: "Multi-image",
          growth: "Multi-image",
          professional: "Unlimited",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Faster AI processing",
        values: { free: false, starter: false, growth: false, professional: true, enterprise: true },
      },
      {
        label: "Custom AI models",
        values: { free: false, starter: false, growth: false, professional: false, enterprise: true },
      },
    ],
  },
  {
    group: "Reports & analytics",
    rows: [
      {
        label: "Annotated shelf image",
        values: { free: true, starter: true, growth: true, professional: true, enterprise: true },
      },
      {
        label: "PDF audit report",
        values: { free: true, starter: true, growth: true, professional: true, enterprise: true },
      },
      {
        label: "CSV export",
        values: { free: false, starter: true, growth: true, professional: true, enterprise: true },
      },
      {
        label: "Scan history",
        values: {
          free: "7 days",
          starter: "Unlimited",
          growth: "Unlimited",
          professional: "Unlimited",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Historical trends",
        values: { free: false, starter: false, growth: true, professional: true, enterprise: true },
      },
      {
        label: "Product movement insights",
        values: { free: false, starter: false, growth: false, professional: true, enterprise: true },
      },
      {
        label: "Low stock alerts",
        values: { free: false, starter: false, growth: false, professional: true, enterprise: true },
      },
      {
        label: "Multi-location dashboard",
        values: { free: false, starter: false, growth: false, professional: false, enterprise: true },
      },
    ],
  },
  {
    group: "Platform & support",
    rows: [
      {
        label: "Team users",
        values: { free: "1", starter: "1", growth: "3", professional: "5", enterprise: "Unlimited" },
      },
      {
        label: "REST API access",
        values: { free: false, starter: false, growth: false, professional: true, enterprise: true },
      },
      {
        label: "Custom integrations",
        values: { free: false, starter: false, growth: false, professional: false, enterprise: true },
      },
      {
        label: "Support",
        values: {
          free: "Community",
          starter: "Email",
          growth: "Email",
          professional: "Priority",
          enterprise: "Dedicated AM + SLA",
        },
      },
      {
        label: "GST invoices",
        values: { free: false, starter: true, growth: true, professional: true, enterprise: true },
      },
    ],
  },
];

/** Add-ons are rendered from this list so new SKUs need no redesign. */
export type AddOn = {
  id: string;
  name: string;
  description: string;
  /** Price in INR; null = quote-based. */
  priceInr: number | null;
  unit: string;
  available: boolean;
};

export const addOns: AddOn[] = [
  {
    id: "scan-pack-500",
    name: "Extra scan pack",
    description: "Top up 500 additional shelf scans, valid for 12 months.",
    priceInr: 749,
    unit: "per pack",
    available: true,
  },
  {
    id: "ai-credits",
    name: "AI credits",
    description: "Additional AI recommendation and re-analysis credits.",
    priceInr: 499,
    unit: "per 1,000 credits",
    available: true,
  },
  {
    id: "storage",
    name: "Extra image storage",
    description: "Retain annotated shelf images and reports for longer.",
    priceInr: 299,
    unit: "per 100 GB / month",
    available: true,
  },
  {
    id: "seats",
    name: "Additional team members",
    description: "Add auditors and store managers beyond your plan seats.",
    priceInr: 199,
    unit: "per seat / month",
    available: true,
  },
  {
    id: "api-usage",
    name: "API usage plan",
    description: "Higher rate limits for the Aislix REST API.",
    priceInr: null,
    unit: "usage based",
    available: false,
  },
];
