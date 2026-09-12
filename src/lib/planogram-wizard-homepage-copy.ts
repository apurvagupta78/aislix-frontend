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
    label: "Add Products & Where They Belong",
    description:
      "Tell Aislix which products should appear on this shelf, where each one belongs, and how many front-facing units should normally be visible. Aislix will use this as the reference when auditing your shelf photo.",
  },
  layout: {
    label: "Show Aislix Where Products Belong",
    description:
      "Set where each product should appear on the shelf and how many front-facing units should normally be visible. Aislix will use this to check shelf placement and facings during your audit.",
  },
  assortment: {
    label: "Required Products",
    description:
      "Mark the products that are required for this store or shelf. Aislix will check during the audit whether those products are visibly present.",
  },
  prices: {
    label: "Set the Expected Shelf Prices",
    description:
      "Add the price that should be displayed for each product. Aislix will compare it with the price visible in the shelf photo.",
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
  "These are the products Aislix will use as reference when auditing the shelf — including shelf position and expected facings.";

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

export const HOMEPAGE_LAYOUT_INSTRUCTION =
  "Choose the shelf position for each product and set its expected facings.";

export const HOMEPAGE_LAYOUT_HELPER =
  "You can edit the layout here or import it with your product CSV.";

export const HOMEPAGE_LAYOUT_EMPTY =
  "Add your products first, then assign where each one should go on the shelf.";

export const HOMEPAGE_LAYOUT_EXAMPLE = {
  title: "Expected shelf layout",
  lines: [
    "Colgate MaxFresh → Shelf 1 → 5 facings",
    "Colgate Total → Shelf 1 → 5 facings",
  ],
  note: "Aislix compares this expected layout with the actual shelf photo.",
} as const;

export const HOMEPAGE_DEMO_LAYOUT_STATUS = {
  title: "Demo shelf layout ready",
  summary: (positionCount: number, plannedFacings: number) =>
    `${positionCount} shelf positions · ${plannedFacings} planned facings`,
  note: "Aislix Demo Data — pre-configured shelf layout for the sample shelf demo.",
} as const;

export const HOMEPAGE_NO_PLANOGRAM_LAYOUT = {
  title: "No shelf layout required.",
  description:
    "Aislix will analyse what is visible in the shelf photo without comparing it to an expected layout.",
} as const;

export const HOMEPAGE_ASSORTMENT_HEADLINE = "Choose the Products That Must Be on the Shelf";

export const HOMEPAGE_ASSORTMENT_HELP =
  "Use this for required assortment or must-stock products. Optional products do not affect the required-product score.";

export const HOMEPAGE_ASSORTMENT_EMPTY = {
  title: "No required products added yet.",
  description: "Add products manually or upload a CSV to define which products must be available.",
} as const;

export const HOMEPAGE_DEMO_ASSORTMENT_STATUS = {
  title: "Demo product requirements are already configured.",
  description: "The sample audit is ready to use. No setup is required.",
} as const;

export const HOMEPAGE_NO_PLANOGRAM_ASSORTMENT = {
  title: "No required product list needed.",
  description:
    "Aislix will analyse the products visible in the shelf photo without comparing them against a predefined required-product list.",
} as const;

export const HOMEPAGE_ASSORTMENT_FIELD_HELP = {
  sku: "Which product is required?",
  requirementType: "Required Assortment",
  outletScope: "Which store or outlet does this requirement apply to?",
  validFrom: "When does this requirement become active?",
  validTo: "Optional end date.",
} as const;

export const HOMEPAGE_ASSORTMENT_CSV = {
  label: "Add Many Products at Once",
  supporting: "Upload a CSV when you have a larger product list. Columns match the manual form above.",
  templateButton: "Download Template",
  uploadButton: "Upload CSV",
} as const;

/** Customer-facing label for assortment list_type values. */
export const HOMEPAGE_PRICES_TAB_HELPER =
  "Add prices manually or upload a CSV to add many products at once.";

export const HOMEPAGE_PRICES_EMPTY = {
  title: "No price rules added yet.",
  description: "Add the expected shelf price for products you want Aislix to check.",
} as const;

export const HOMEPAGE_DEMO_PRICES_STATUS = {
  title: "Demo prices are already configured.",
  description: "The sample audit is ready to check shelf prices.",
} as const;

export const HOMEPAGE_NO_PLANOGRAM_PRICES = {
  title: "No price setup required.",
  description:
    "Aislix will analyse visible shelf prices when they can be read from the photo, without comparing them against a predefined expected price.",
} as const;

export const HOMEPAGE_PRICE_FIELD_HELP = {
  sku: "Which product does this price belong to?",
  labelLocation: "Where should the price label appear?",
  expectedPrice: "What price should be shown on the shelf?",
  currency: "Choose the currency used for this shelf.",
  validFrom: "When does this price become active?",
  validTo: "Optional end date.",
} as const;

export const HOMEPAGE_PRICES_CSV = {
  label: "Add Many Prices at Once",
  supporting: "Upload a CSV when you have a larger price list.",
  templateButton: "Download Template",
  uploadButton: "Upload CSV",
} as const;

export function homepageRequiredProductTypeLabel(
  listType: "mandatory_assortment" | "msl" | "optional" | string,
): string {
  if (listType === "msl") return "Must-Stock";
  if (listType === "mandatory_assortment") return "Required Assortment";
  return "Optional";
}
