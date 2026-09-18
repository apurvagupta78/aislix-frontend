import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { buildAskAccessScope } from "@/lib/ask-aislix/context";
import { mergeHelpAskCategories } from "@/lib/ask-aislix/help-ask-aislix.categories";
import { generateHelpAskQuestionWithOpenAI } from "@/lib/ask-aislix/help-ask-aislix.openai";
import { validateHelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.validate";
import type {
  HelpAskAuthorizedOptions,
  HelpAskQuestionResult,
} from "@/lib/ask-aislix/help-ask-aislix.types";
import { loadShelfCategories } from "@/lib/categories.server";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function getHelpAskAislixOptionsServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
): Promise<HelpAskAuthorizedOptions> {
  const scope = await buildAskAccessScope(supabase, userId, orgId);
  const allowed = new Set(scope.allowedStoreIds);

  const { data: storeRows, error } = await supabase
    .from("stores")
    .select("id, name, city, country")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("name");

  if (error) throw new Error("Could not load authorized locations.");

  const stores = (storeRows ?? [])
    .filter((s) => allowed.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      country: s.country,
    }));

  let scanRows: Array<{ category: string | null; sub_category: string | null }> = [];
  if (allowed.size > 0) {
    const { data } = await supabase
      .from("shelf_scans")
      .select("category, sub_category")
      .eq("org_id", orgId)
      .in("store_id", [...allowed])
      .not("category", "is", null)
      .limit(5000);
    scanRows = data ?? [];
  }

  const categoryMaster = await loadShelfCategories();
  const { categoryCatalog, categories } = mergeHelpAskCategories(categoryMaster, scanRows);

  return {
    stores,
    countries: uniqueStrings(stores.map((s) => s.country ?? "")),
    cities: uniqueStrings(stores.map((s) => s.city ?? "")),
    allOrgCities: uniqueStrings((storeRows ?? []).map((s) => s.city ?? "")),
    allOrgCountries: uniqueStrings((storeRows ?? []).map((s) => s.country ?? "")),
    categories,
    categoryCatalog,
    canViewAllLocations: stores.length > 1 || scope.isOrgAdmin,
  };
}

export async function buildHelpAskQuestionServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  rawIntent: unknown,
): Promise<HelpAskQuestionResult> {
  try {
    const scope = await buildAskAccessScope(supabase, userId, orgId);
    const options = await getHelpAskAislixOptionsServer(supabase, userId, orgId);
    const validated = validateHelpAskIntent(rawIntent, scope, options);
    if (!validated.ok) {
      return { ok: false, question: "", error: validated.error };
    }

    const intent = validated.intent;

    const ai = await generateHelpAskQuestionWithOpenAI(intent);
    return {
      ok: true,
      question: ai.generated_question.trim(),
      contextSummary: ai.context_summary.trim(),
      selectedFilters: ai.selected_filters,
      validatedIntent: intent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build question.";
    return { ok: false, question: "", error: message.slice(0, 500) };
  }
}
