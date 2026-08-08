// Aislix plan catalogue. This is product configuration (not scan data), so it
// is defined statically here and consumed by both /pricing and /billing.
// Prices are in INR. Annual pricing = 10 months (≈17% saving).

export type PlanId = "free" | "starter" | "professional" | "enterprise";
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
  /** Included scans per month; null = unlimited/quote-based. */
  monthlyScanQuota: number | null;
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
    scanLimitLabel: "3 scans per day",
    monthlyScanQuota: 3,
    features: [
      "3 scans per day",
      "1 image per scan",
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
    scanLimitLabel: "500 scans per month",
    monthlyScanQuota: 500,
    features: [
      "500 scans per month",
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
    id: "professional",
    name: "Professional",
    tagline: "For supermarkets, dark stores, warehouses, FMCG brands, distributors and local stores",
    monthlyPrice: 4999,
    annualPrice: 4999 * ANNUAL_MONTHS_BILLED,
    scanLimitLabel: "Unlimited scans",
    monthlyScanQuota: null,
    features: [
      "Unlimited scans",
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
    scanLimitLabel: "Unlimited scans & users",
    monthlyScanQuota: null,
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

export function priceFor(plan: Plan, cycle: BillingCycle): string {
  if (plan.monthlyPrice === null) return "Custom";
  if (plan.monthlyPrice === 0) return "₹0";
  if (cycle === "monthly") return formatInr(plan.monthlyPrice);
  return formatInr(Math.round((plan.annualPrice ?? 0) / 12));
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
          free: "3 / day",
          starter: "500 / month",
          professional: "Unlimited",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Images per scan",
        values: { free: "1", starter: "Multi-image", professional: "Unlimited", enterprise: "Unlimited" },
      },
      {
        label: "Faster AI processing",
        values: { free: false, starter: false, professional: true, enterprise: true },
      },
      {
        label: "Custom AI models",
        values: { free: false, starter: false, professional: false, enterprise: true },
      },
    ],
  },
  {
    group: "Reports & analytics",
    rows: [
      { label: "Annotated shelf image", values: { free: true, starter: true, professional: true, enterprise: true } },
      { label: "PDF audit report", values: { free: true, starter: true, professional: true, enterprise: true } },
      { label: "CSV export", values: { free: false, starter: true, professional: true, enterprise: true } },
      {
        label: "Scan history",
        values: { free: "7 days", starter: "Unlimited", professional: "Unlimited", enterprise: "Unlimited" },
      },
      { label: "Historical trends", values: { free: false, starter: false, professional: true, enterprise: true } },
      {
        label: "Product movement insights",
        values: { free: false, starter: false, professional: true, enterprise: true },
      },
      { label: "Low stock alerts", values: { free: false, starter: false, professional: true, enterprise: true } },
      {
        label: "Multi-location dashboard",
        values: { free: false, starter: false, professional: false, enterprise: true },
      },
    ],
  },
  {
    group: "Platform & support",
    rows: [
      {
        label: "Team members",
        values: { free: "1", starter: "3", professional: "15", enterprise: "Unlimited" },
      },
      { label: "REST API access", values: { free: false, starter: false, professional: true, enterprise: true } },
      { label: "Custom integrations", values: { free: false, starter: false, professional: false, enterprise: true } },
      {
        label: "Support",
        values: { free: "Community", starter: "Email", professional: "Priority", enterprise: "Dedicated AM + SLA" },
      },
      { label: "GST invoices", values: { free: false, starter: true, professional: true, enterprise: true } },
    ],
  },
];

/** Add-ons are rendered from this list so new SKUs need no redesign. */
export type AddOn = {
  id: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  available: boolean;
};

export const addOns: AddOn[] = [
  {
    id: "scan-pack-500",
    name: "Extra scan pack",
    description: "Top up 500 additional shelf scans, valid for 12 months.",
    price: "₹749",
    unit: "per pack",
    available: true,
  },
  {
    id: "ai-credits",
    name: "AI credits",
    description: "Additional AI recommendation and re-analysis credits.",
    price: "₹499",
    unit: "per 1,000 credits",
    available: true,
  },
  {
    id: "storage",
    name: "Extra image storage",
    description: "Retain annotated shelf images and reports for longer.",
    price: "₹299",
    unit: "per 100 GB / month",
    available: true,
  },
  {
    id: "seats",
    name: "Additional team members",
    description: "Add auditors and store managers beyond your plan seats.",
    price: "₹199",
    unit: "per seat / month",
    available: true,
  },
  {
    id: "api-usage",
    name: "API usage plan",
    description: "Higher rate limits for the Aislix REST API.",
    price: "Custom",
    unit: "usage based",
    available: false,
  },
];
