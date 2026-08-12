/**
 * First-time setup wizard state.
 *
 * The wizard is shown once per user: `profiles.onboarding_completed_at` is the
 * single source of truth. Completing or skipping the last step stamps it, and
 * it is never shown again.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, getUser, requireOrgId, requireUserId } from "@/lib/db/context";

export type OnboardingStatus = {
  /** False only for an authenticated user who has never finished the wizard. */
  completed: boolean;
  full_name: string;
  job_title: string;
  company_name: string;
};

/**
 * Reads whether the signed-in user still needs first-time setup.
 *
 * The DB decides: `should_show_onboarding` is true only for a brand-new user
 * whose workspace has zero stores and zero scans. Existing users are stamped
 * as completed so the wizard can never appear again.
 */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const user = await getUser();
  if (!user) {
    return { completed: true, full_name: "", job_title: "", company_name: "" };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, job_title")
    .eq("id", user.id)
    .maybeSingle();
  if (error) dbError(error, "Could not check your setup status.");

  let completed = Boolean(data?.onboarding_completed_at);
  if (!completed) {
    const { data: shouldShow, error: rpcError } = await supabase.rpc("should_show_onboarding", {
      p_user_id: user.id,
    });
    if (rpcError || shouldShow === false) {
      completed = true;
      // Backfill existing users so the check is a one-time cost.
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }

  let companyName = "";
  try {
    const orgId = await requireOrgId();
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    companyName = org?.name ?? "";
  } catch {
    companyName = "";
  }

  return {
    completed,
    full_name: data?.full_name ?? "",
    job_title: data?.job_title ?? "",
    company_name: companyName,
  };
}


/** Step 1 — profile details. Company name is written to the active org. */
export async function saveOnboardingProfile(input: {
  full_name: string;
  job_title: string;
  company_name: string;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name.trim(), job_title: input.job_title.trim() })
    .eq("id", userId);
  if (error) dbError(error, "Could not save your profile details.");

  const companyName = input.company_name.trim();
  if (!companyName) return;
  try {
    const orgId = await requireOrgId();
    // Non-owners are blocked by RLS; the org name simply stays unchanged.
    await supabase.from("organizations").update({ name: companyName }).eq("id", orgId);
  } catch {
    // No org context yet — nothing to rename.
  }
}

/** Marks setup as done so the wizard never appears again (RPC — RLS-proof). */
export async function completeOnboarding(): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc("complete_onboarding", { p_user_id: userId });
  if (error) dbError(error, "Could not finish setup.");
  if (!data) throw new Error("Could not finish setup. Please try again.");
}

