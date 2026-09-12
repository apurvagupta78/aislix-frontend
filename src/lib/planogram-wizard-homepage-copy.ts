/**
 * Simplified customer-facing copy for the homepage demo custom shelf setup wizard.
 * Internal step IDs and data model are unchanged.
 */

import type { PlanogramWizardStepId } from "@/lib/planogram-wizard-config";

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Kolkata";
  }
}

export const HOMEPAGE_WIZARD_STEP_COPY: Record<
  PlanogramWizardStepId,
  { label: string; description: string }
> = {
  basics: {
    label: "Shelf Basics",
    description: "Start with the basic details of the shelf you want Aislix to audit.",
  },
  fixture: {
    label: "Describe Your Shelf",
    description:
      "Tell Aislix what the shelf looks like — its type, size and number of shelves. This helps Aislix understand the physical space before analysing the products.",
  },
  products: {
    label: "Add the Products on Your Shelf",
    description:
      "Tell Aislix which products should appear on this shelf and how they should normally be displayed.",
  },
  layout: {
    label: "Shelf Layout",
    description: "Set where each product belongs and how many facings are expected.",
  },
  assortment: {
    label: "Required Products",
    description: "Mark which products must be on the shelf for this audit.",
  },
  prices: {
    label: "Prices",
    description: "Add expected shelf prices where price checks matter.",
  },
  promotions: {
    label: "Promotions",
    description: "Add active promotions that should be visible on the shelf.",
  },
  role_settings: {
    label: "Role Settings",
    description: "Add any extra settings needed for your audit role.",
  },
  scoring: {
    label: "Audit Rules",
    description: "Set the targets Aislix should use when scoring this audit.",
  },
  readiness: {
    label: "Ready to Audit",
    description: "Review what is ready before you run the AI audit.",
  },
};

export const HOMEPAGE_SHELF_SETUP_FLOW =
  "Set up the expected shelf → Upload the real shelf photo → Aislix compares both → Get your audit";

export const HOMEPAGE_PRODUCTS_TAB_HELPER =
  "Add products one at a time or upload a CSV to add many products at once.";

export const HOMEPAGE_PRODUCTS_TABLE_TITLE = "Products in This Shelf Setup";

export const HOMEPAGE_PRODUCTS_TABLE_DESCRIPTION =
  "These are the products Aislix will use as reference when auditing the shelf.";

export const HOMEPAGE_PRODUCT_FIELD_HELP = {
  brand: "Which brand is this product?",
  productName: "What is the product called?",
  variant: "Size, flavour, pack or other variation.",
  expectedFacings: "How many front-facing units should normally be visible?",
  minMaxFacings: "Optional range for acceptable shelf facings.",
  expectedShelfUnits: "Optional number of units expected on the shelf.",
  price: "Optional expected shelf price.",
  dailySales: "Optional estimated units sold per day.",
  sku: "Optional product ID or barcode.",
  shelfPosition: "Where should this product appear?",
} as const;

export const HOMEPAGE_DEMO_PRODUCTS_STATUS = {
  title: "Demo shelf setup loaded",
  summary: (productCount: number, shelfCount: number, positionCount: number) =>
    `${productCount} products · ${shelfCount} shelves · ${positionCount} positions`,
  note: "Aislix Demo Data — pre-configured reference products for the sample shelf demo.",
} as const;

export const HOMEPAGE_NO_PLANOGRAM_PRODUCTS = {
  title: "No product setup required.",
  description:
    "Aislix will analyse the products that are visible in your shelf photo and provide the insights that can be determined from the image.",
  cta: "Continue to Audit",
} as const;
