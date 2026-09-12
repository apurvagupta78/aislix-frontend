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
    label: "Products",
    description: "Add the products that should appear on this shelf.",
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
