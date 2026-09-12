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
    description:
      "Add any offers or promotions that should currently be visible on the shelf. Aislix will check the shelf photo against these requirements and flag anything that is missing or incorrect.",
  },
  role_settings: {
    label: "Distributor Setup",
    description:
      "Tell Aislix which distributor portfolio this audit belongs to. Aislix will use the distributor's products and must-stock requirements to check outlet execution.",
  },
  scoring: {
    label: "Set Your Targets",
    description:
      "Tell Aislix what level of shelf performance you expect. These targets are used to show whether your audit is on track.",
  },
  readiness: {
    label: "Ready to Audit",
    description:
      "Aislix checks that it has the information needed to run your audit. Review what's ready and what's still missing before you begin.",
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

export const HOMEPAGE_FREE_AUDIT_INTRO =
  "Choose the type of shelf you want to analyse. For this free demo, Aislix has already prepared the shelf setup, products and audit rules for you.";

export const HOMEPAGE_DEMO_READY_CARD = {
  title: "Your Demo Shelf Is Ready",
  subtitle: "Everything is pre-configured for this demo.",
  summary: (productCount: number, shelfCount: number, positionCount: number) =>
    `${productCount} products · ${shelfCount} shelves · ${positionCount} shelf positions`,
  ctaHint: "Just start the audit to see what Aislix finds.",
  disclosure: "Demo data · Reference information is fictional and created for this sample audit.",
} as const;

export const HOMEPAGE_DEMO_READY_CHECKLIST = [
  "Products",
  "Shelf layout",
  "Required products",
  "Prices",
  "Promotions",
  "Audit targets",
] as const;

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

export const HOMEPAGE_DISTRIBUTOR_SETUP = {
  headline: "Set Up Your Distributor",
  explanation:
    "This helps Aislix check whether required distributor products are available at the outlet.",
  fieldLabel: "Distributor / Portfolio",
  fieldHelper: "Select the distributor or product portfolio being audited.",
  noneModeNote:
    "Select the distributor portfolio if you want Aislix to check distributor must-stock requirements.",
} as const;

export const HOMEPAGE_DEMO_DISTRIBUTOR_STATUS = {
  title: "Demo distributor setup is ready.",
  description:
    "The sample audit already includes a distributor portfolio and must-stock requirements.",
} as const;

export const HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM = {
  title: "Audit Your Shelf Without a Planogram",
  introduction:
    "No planogram? No problem. Aislix will analyse what is visible in your shelf photo and show you the retail insights that can be measured from the image.",
  limitation:
    "No expected shelf setup is used, so checks that require a planogram or predefined product list won't be scored.",
  cta: "Start Audit",
  capabilities: [
    {
      id: "products_brands",
      title: "PRODUCTS & BRANDS",
      description: "See what products and brands are visible on the shelf.",
    },
    {
      id: "availability_facings",
      title: "AVAILABILITY & FACINGS",
      description: "Identify visible products and estimate their shelf presence and front facings.",
    },
    {
      id: "prices_promotions",
      title: "PRICES & PROMOTIONS",
      description: "Read visible prices and promotional signs when the image is clear enough.",
    },
    {
      id: "shelf_issues",
      title: "SHELF ISSUES",
      description: "Highlight visible shelf issues and areas that need attention.",
    },
  ],
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

export const HOMEPAGE_PROMOTIONS_HEADLINE = "Set Up Active Promotions";

export const HOMEPAGE_PROMOTIONS_TAB_HELPER =
  "Add promotions manually or upload a CSV for multiple promotions.";

export const HOMEPAGE_PROMOTIONS_EMPTY = {
  title: "No promotions added yet.",
  description: "Add a promotion if this shelf should currently display an offer.",
} as const;

export const HOMEPAGE_DEMO_PROMOTIONS_STATUS = {
  title: "Demo promotions are already configured.",
  description: "The sample audit is ready to check promotional execution.",
} as const;

export const HOMEPAGE_NO_PLANOGRAM_PROMOTIONS = {
  title: "No promotion setup required.",
  description:
    "Aislix will identify visible promotional signs and offers where they can be detected from the shelf photo.",
} as const;

export const HOMEPAGE_PROMOTION_FIELD_HELP = {
  promotionName: "What is this promotion called?",
  productsIncluded: "Which products are part of the promotion?",
  startDate: "When does the promotion start?",
  endDate: "When does it end?",
  displayLocation: "Where should the promotion appear?",
  offerText: "What offer should be shown?",
  promotionalPrice: "What price should be displayed?",
  requiredFacings: "How many front-facing units should be displayed?",
} as const;

export const HOMEPAGE_PROMOTIONS_CSV = {
  label: "Add Multiple Promotions",
  supporting: "Upload a CSV when you have several promotions to configure.",
  templateButton: "Download Template",
  uploadButton: "Upload CSV",
} as const;

export const HOMEPAGE_SCORING_HEADLINE = "Set Your Shelf Performance Targets";

export const HOMEPAGE_SCORING_NOTE =
  "Targets are optional and can be changed for each audit. They are used as your own performance benchmarks, not industry-wide standards.";

export const HOMEPAGE_SCORING_TARGET_HELP = "Target %";

export const HOMEPAGE_SCORING_NOT_CONFIGURED = "Not configured";

export const HOMEPAGE_DEMO_SCORING_STATUS = {
  title: "Demo targets are already configured.",
  description: "Aislix will use the sample audit benchmarks for this demo.",
} as const;

export const HOMEPAGE_SCORING_TARGET_FIELDS = [
  { key: "osa_target", label: "On-Shelf Availability", placeholder: "e.g. 95" },
  { key: "planogram_target", label: "Planogram Compliance", placeholder: "e.g. 90" },
  { key: "assortment_target", label: "Assortment Compliance", placeholder: "e.g. 90" },
  { key: "price_target", label: "Price Compliance", placeholder: "e.g. 95" },
  { key: "promotional_target", label: "Promotional Compliance", placeholder: "e.g. 85" },
  { key: "msl_target", label: "Must-Stock Compliance", placeholder: "e.g. 90" },
  { key: "share_of_shelf_target", label: "Share of Shelf", placeholder: "e.g. 55" },
] as const;

/** Targets that need planogram/reference setup — hidden or read-only in audit-without-planogram mode. */
export const HOMEPAGE_READINESS_HEADLINE = "Your Audit Is Almost Ready";

export const HOMEPAGE_READINESS_TRUST =
  "Missing optional information will simply disable the related check. Aislix will never invent a result.";

export const HOMEPAGE_READINESS_SUMMARY_LABEL = "Audit readiness";

export const HOMEPAGE_DEMO_READINESS_STATUS = {
  title: "Your Demo Is Ready",
  description: "All required demo data is already configured. Start the AI audit to see Aislix in action.",
} as const;

export const HOMEPAGE_NONE_READINESS_STATUS = {
  title: "Your Photo Is Ready for Analysis",
  description:
    "Aislix will analyse what is visible in the shelf image. Checks that require an expected shelf setup will not be scored.",
} as const;

export const HOMEPAGE_READINESS_CHECKS = [
  {
    id: "products" as const,
    title: "PRODUCTS",
    description: "Products added to this shelf setup.",
  },
  {
    id: "shelf_layout" as const,
    title: "SHELF LAYOUT",
    description: "Product positions and expected facings.",
  },
  {
    id: "required_products" as const,
    title: "REQUIRED PRODUCTS",
    description: "Products that must be present.",
  },
  {
    id: "prices" as const,
    title: "PRICES",
    description: "Expected shelf prices.",
  },
  {
    id: "promotions" as const,
    title: "PROMOTIONS",
    description: "Active promotions that should be visible.",
  },
] as const;

export const HOMEPAGE_READINESS_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  ready: { label: "Ready", className: "text-success" },
  not_set: { label: "Not set", className: "text-muted-foreground" },
  optional: { label: "Optional", className: "text-muted-foreground" },
  not_required: { label: "Not required", className: "text-muted-foreground" },
  not_applicable: { label: "Not applicable", className: "text-muted-foreground" },
  ready_to_analyse: { label: "Ready to Analyse", className: "text-success" },
};

export const HOMEPAGE_SCORING_NONE_MODE_KEYS = new Set([
  "planogram_target",
  "assortment_target",
  "price_target",
  "promotional_target",
  "msl_target",
  "share_of_shelf_target",
]);

export function homepageRequiredProductTypeLabel(
  listType: "mandatory_assortment" | "msl" | "optional" | string,
): string {
  if (listType === "msl") return "Must-Stock";
  if (listType === "mandatory_assortment") return "Required Assortment";
  return "Optional";
}
