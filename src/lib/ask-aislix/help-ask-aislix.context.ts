import { HELP_ROLE_CARDS } from "@/lib/ask-aislix/help-ask-aislix.config";
import type { HelpOperatingRole } from "@/lib/ask-aislix/help-ask-aislix.types";

const OPERATING_CONTEXT: Record<HelpOperatingRole, string> = {
  supermarket: "I am working in a supermarket operation.",
  fmcg_distributor: "I am working in an FMCG / Distributor operation.",
  local_store: "I am working in a local store operation.",
  dark_store: "I am working in a dark store operation.",
  warehouse: "I am working in a warehouse operation.",
};

const OPERATING_MODEL_LABEL: Record<HelpOperatingRole, string> = {
  supermarket: "Supermarket",
  fmcg_distributor: "FMCG",
  local_store: "Local Store",
  dark_store: "Dark Store",
  warehouse: "Warehouse",
};

export const USER_ROLE_PLACEHOLDERS: Record<HelpOperatingRole, string> = {
  supermarket: "e.g. Store Manager, Assistant Store Manager, Department Manager",
  fmcg_distributor:
    "e.g. Sales Manager, Territory Manager, Distributor Manager, Sales Representative",
  local_store: "e.g. Store Manager, Assistant Store Manager, Store Owner",
  dark_store: "e.g. Dark Store Manager, Assistant Manager, Operations Manager",
  warehouse: "e.g. Warehouse Manager, Assistant Warehouse Manager, Operations Manager",
};

export function buildOperatingContext(role: HelpOperatingRole): string {
  return OPERATING_CONTEXT[role];
}

export function buildUserContext(role: HelpOperatingRole, userRole: string): string {
  const trimmed = userRole.trim();
  const modelLabel = OPERATING_MODEL_LABEL[role];
  const article = modelLabel === "FMCG" ? "an" : "a";
  return `I am ${article} ${modelLabel} ${trimmed}.`;
}

export function operatingModelLabel(role: HelpOperatingRole): string {
  return HELP_ROLE_CARDS.find((r) => r.id === role)?.label ?? role;
}

export const CUSTOM_REQUEST_PLACEHOLDERS: Record<HelpOperatingRole, string> = {
  supermarket:
    "Example: Show me whether the brands with the most shelf space are also the ones with the best availability...",
  fmcg_distributor:
    "Example: I want to know which outlets are repeatedly failing execution for our top brands...",
  local_store:
    "Example: I want to know which products keep running short in my stores...",
  dark_store:
    "Example: I want to know why inventory variance is repeatedly high in some of my dark stores...",
  warehouse:
    "Example: I want to know which warehouse zones keep having picking and location accuracy problems...",
};
