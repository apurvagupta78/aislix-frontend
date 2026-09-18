import type { AskAislixAccessScope } from "@/lib/ask-aislix/ask-aislix.types";
import { assertStoreAccess } from "@/lib/ask-aislix/context";
import { getAvailableTopicsForRole } from "@/lib/ask-aislix/help-ask-aislix.config";
import {
  HelpAskIntentSchema,
  type HelpAskAuthorizedOptions,
  type HelpAskIntent,
} from "@/lib/ask-aislix/help-ask-aislix.types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function validateCustomUserRequestLocations(
  customText: string | undefined,
  options: HelpAskAuthorizedOptions,
): string | null {
  if (!customText?.trim()) return null;

  const lower = customText.toLowerCase();
  const allowedCities = new Set(options.cities.map(normalize));
  const allowedCountries = new Set(options.countries.map(normalize));

  for (const city of options.allOrgCities) {
    const cityNorm = normalize(city);
    if (cityNorm.length < 3) continue;
    if (lower.includes(cityNorm) && !allowedCities.has(cityNorm)) {
      return `I can't access ${city} stores under your account.`;
    }
  }

  for (const country of options.allOrgCountries) {
    const countryNorm = normalize(country);
    if (countryNorm.length < 3) continue;
    if (lower.includes(countryNorm) && !allowedCountries.has(countryNorm)) {
      return `I can't access locations in ${country} under your account.`;
    }
  }

  return null;
}

export function validateHelpAskIntent(
  raw: unknown,
  scope: AskAislixAccessScope,
  options: HelpAskAuthorizedOptions,
): { ok: true; intent: HelpAskIntent } | { ok: false; error: string } {
  const parsed = HelpAskIntentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid question builder input." };
  }

  const intent = parsed.data;
  const allowedStoreIds = new Set(scope.allowedStoreIds);
  const allowedCities = new Set(options.cities.map(normalize));
  const allowedCountries = new Set(options.countries.map(normalize));

  const allowedTopics = new Set(
    getAvailableTopicsForRole(intent.operating_role).map((t) => t.id),
  );
  if (!allowedTopics.has(intent.topic)) {
    return { ok: false, error: "The selected topic is not available in Aislix yet." };
  }

  const customLocationError = validateCustomUserRequestLocations(
    intent.custom_user_request,
    options,
  );
  if (customLocationError) {
    return { ok: false, error: customLocationError };
  }

  if (intent.locations.scope === "specific") {
    if (intent.locations.country) {
      if (!allowedCountries.has(normalize(intent.locations.country))) {
        return { ok: false, error: "Selected country is outside your authorized scope." };
      }
    }

    if (intent.locations.city) {
      if (!allowedCities.has(normalize(intent.locations.city))) {
        return { ok: false, error: "Selected city is outside your authorized scope." };
      }
    }

    for (const storeId of intent.locations.store_ids ?? []) {
      if (!assertStoreAccess(scope, storeId)) {
        return { ok: false, error: "One or more selected stores are outside your authorized scope." };
      }
      if (!allowedStoreIds.has(storeId)) {
        return { ok: false, error: "One or more selected stores are outside your authorized scope." };
      }
    }
  }

  if (intent.locations.scope === "all_my_locations" && scope.allowedStoreIds.length === 0) {
    return { ok: false, error: "You do not have any authorized locations to analyze." };
  }

  if (intent.metric) {
    const unavailable = ["audit_pass", "evidence_coverage", "sla_compliance", "inventory_accuracy"];
    if (unavailable.includes(intent.metric)) {
      return { ok: false, error: "The selected metric is not available in Aislix yet." };
    }
  }

  return { ok: true, intent };
}
