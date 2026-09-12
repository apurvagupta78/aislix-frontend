/**
 * Homepage planogram wizard — role-first step order and per-role copy.
 * Internal step IDs and data model unchanged; only visibility and labels vary by role.
 */

import type { AuditRoleTab } from "@/lib/role-audit-ui";
import {
  PLANOGRAM_WIZARD_STEPS,
  type PlanogramWizardStep,
  type PlanogramWizardStepId,
} from "@/lib/planogram-wizard-config";

export type HomepageRoleOption = {
  role: AuditRoleTab;
  title: string;
  description: string;
};

export const HOMEPAGE_ROLE_OPTIONS: HomepageRoleOption[] = [
  {
    role: "supermarket",
    title: "Supermarket",
    description:
      "Check availability, shelf execution, assortment, prices and promotions.",
  },
  {
    role: "darkstore",
    title: "Dark Store",
    description:
      "Check availability, product locations, shelf layout, assortment and facings.",
  },
  {
    role: "fmcg",
    title: "FMCG Brand",
    description:
      "Measure brand presence, Share of Shelf, availability, facings and promotions.",
  },
  {
    role: "distributor",
    title: "Distributor",
    description:
      "Check outlet execution, must-stock products, availability, prices and promotions.",
  },
  {
    role: "local",
    title: "Local Store",
    description:
      "Track availability, assortment, facings, prices and promotions.",
  },
];

export const HOMEPAGE_ROLE_STEP = {
  label: "Choose Your Audit Type",
  heading: "Who is this audit for?",
  description:
    "Choose your role first. Aislix will customise the audit setup, checks and insights around what matters to your business.",
  helper: "You can change this before starting the audit.",
} as const;

/** Role-specific wizard step order for homepage (includes leading role step). */
const HOMEPAGE_ROLE_WIZARD_ORDER: Record<AuditRoleTab, PlanogramWizardStepId[]> = {
  supermarket: [
    "role",
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "scoring",
    "readiness",
  ],
  darkstore: [
    "role",
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "facings",
    "scoring",
    "readiness",
  ],
  fmcg: [
    "role",
    "basics",
    "fixture",
    "products",
    "layout",
    "role_settings",
    "promotions",
    "scoring",
    "readiness",
  ],
  distributor: [
    "role",
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "scoring",
    "readiness",
  ],
  local: [
    "role",
    "basics",
    "fixture",
    "products",
    "layout",
    "assortment",
    "prices",
    "promotions",
    "scoring",
    "readiness",
  ],
};

type StepCopy = { label: string; description: string };

const SHARED_AFTER_ROLE: Partial<Record<PlanogramWizardStepId, StepCopy>> = {
  basics: {
    label: "Audit Basics",
    description: "Name this audit and set the category and timing Aislix should use.",
  },
  products: {
    label: "Products",
    description:
      "Add the products that should appear on this shelf. Aislix uses this list when matching what it sees in your photo.",
  },
  layout: {
    label: "Shelf Layout",
    description:
      "Set where each product belongs on the shelf and how many front-facing units should normally be visible.",
  },
  promotions: {
    label: "Promotions",
    description:
      "Add offers or promotions that should currently be visible. Aislix checks the shelf photo against these requirements.",
  },
  scoring: {
    label: "Audit Targets",
    description:
      "Tell Aislix what level of shelf performance you expect. These targets show whether your audit is on track.",
  },
  readiness: {
    label: "Ready to Audit",
    description:
      "Review what's ready before you upload a shelf photo and start the audit.",
  },
};

const ROLE_STEP_COPY: Record<AuditRoleTab, Partial<Record<PlanogramWizardStepId, StepCopy>>> = {
  supermarket: {
    ...SHARED_AFTER_ROLE,
    fixture: {
      label: "Shelf & Store",
      description:
        "Tell Aislix which store and shelf you are auditing and describe the physical fixture.",
    },
    assortment: {
      label: "Required Products",
      description:
        "Mark products that must be on this shelf. Aislix checks whether they are visibly present during the audit.",
    },
    prices: {
      label: "Prices",
      description:
        "Add the price that should be displayed for each product. Aislix compares it with the price visible in the photo.",
    },
  },
  darkstore: {
    ...SHARED_AFTER_ROLE,
    fixture: {
      label: "Store & Pick Locations",
      description:
        "Tell Aislix which store and pick locations you are auditing and describe the shelf or bin layout.",
    },
    assortment: {
      label: "Required Products",
      description:
        "Mark products that must be available at these locations. Aislix checks whether they are visibly present.",
    },
    facings: {
      label: "Facings",
      description:
        "Confirm how many front-facing units should be visible for each product. Aislix uses this when checking shelf presence.",
    },
  },
  fmcg: {
    ...SHARED_AFTER_ROLE,
    fixture: {
      label: "Brand & Category",
      description:
        "Tell Aislix which brand and category this audit focuses on so Share of Shelf and availability are measured correctly.",
    },
    role_settings: {
      label: "Competitors & Share of Shelf",
      description:
        "Set your primary brand scope. Aislix compares your brand's shelf presence against other brands in the same category.",
    },
  },
  distributor: {
    ...SHARED_AFTER_ROLE,
    fixture: {
      label: "Distributor & Outlet",
      description:
        "Tell Aislix which distributor and outlet you are auditing so the right product portfolio and must-stock rules apply.",
    },
    assortment: {
      label: "Must-Stock Products",
      description:
        "List products that must be stocked at this outlet. Aislix checks whether each one is visibly available.",
    },
    prices: {
      label: "Prices",
      description:
        "Add expected shelf prices for distributor products. Aislix compares them with prices visible in the photo.",
    },
  },
  local: {
    ...SHARED_AFTER_ROLE,
    fixture: {
      label: "Store & Shelf",
      description:
        "Tell Aislix which store and shelf you are auditing and describe the physical fixture.",
    },
    assortment: {
      label: "Required Products",
      description:
        "Mark products that should normally be on this shelf. Aislix checks whether they are visibly present.",
    },
    prices: {
      label: "Prices",
      description:
        "Add the price that should be displayed for each product. Aislix compares it with the price visible in the photo.",
    },
  },
};

export function homepageWizardStepsForRole(role: AuditRoleTab): PlanogramWizardStep[] {
  const ids = HOMEPAGE_ROLE_WIZARD_ORDER[role];
  return ids.map((id) => {
    const base = PLANOGRAM_WIZARD_STEPS[id];
    const copy = getHomepageRoleStepCopy(role, id);
    return { ...base, ...copy };
  });
}

export function getHomepageRoleStepCopy(
  role: AuditRoleTab,
  stepId: PlanogramWizardStepId,
): StepCopy {
  if (stepId === "role") {
    return {
      label: HOMEPAGE_ROLE_STEP.label,
      description: HOMEPAGE_ROLE_STEP.description,
    };
  }
  return ROLE_STEP_COPY[role][stepId] ?? {
    label: PLANOGRAM_WIZARD_STEPS[stepId].label,
    description: PLANOGRAM_WIZARD_STEPS[stepId].description,
  };
}

export const HOMEPAGE_DISTRIBUTOR_OUTLET = {
  heading: "Tell Aislix Which Distributor and Outlet You're Auditing",
  description:
    "This helps Aislix use the right product portfolio and must-stock requirements for the outlet.",
  portfolioLabel: "Distributor / Portfolio",
  portfolioHelper: "Which distributor or product portfolio is being audited?",
  outletLabel: "Store / Outlet",
  outletHelper: "Which outlet are you checking?",
  territoryLabel: "Territory / Area",
  territoryHelper: "Where is the outlet located?",
  salesRepLabel: "Sales Representative",
  salesRepHelper: "Who is responsible for this outlet?",
  salesRepOptional: "Optional.",
  footer:
    "Aislix will use this information to apply the right distributor product and must-stock rules to the audit.",
} as const;

export const HOMEPAGE_DEMO_ROLE_READY: Partial<
  Record<AuditRoleTab, { title: string; description: string }>
> = {
  distributor: {
    title: "Your distributor demo is ready.",
    description:
      "Aislix has already prepared the distributor, outlet and product requirements for this sample audit.",
  },
};
