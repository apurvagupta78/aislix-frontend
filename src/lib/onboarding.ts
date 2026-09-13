/**
 * First-time setup wizard state.
 *
 * The wizard is shown once per user: `profiles.onboarding_completed_at` is the
 * single source of truth. Completing or skipping the last step stamps it, and
 * it is never shown again.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, getUser, requireOrgId, requireUserId } from "@/lib/db/context";
import {
  inferRoleFamily,
  normalizeCustomerType,
  type CustomerType,
  type RoleFamily,
} from "@/lib/customer-context";

export type OnboardingStatus = {
  /** False only for an authenticated user who has never finished the wizard. */
  completed: boolean;
  full_name: string;
  job_title: string;
  company_name: string;
  customer_type: CustomerType;
  role_family: RoleFamily;
};

/**
 * Reads whether the signed-in user still needs first-time setup.
 *
 * `profiles.onboarding_completed_at` is the only completion signal. Creating
 * stores, audits, planograms, or invitations must never complete the wizard.
 */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const user = await getUser();
  if (!user) {
    return {
      completed: true,
      full_name: "",
      job_title: "",
      company_name: "",
      customer_type: "supermarket",
      role_family: "operations",
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, job_title, role_family")
    .eq("id", user.id)
    .maybeSingle();
  if (error) dbError(error, "Could not check your setup status.");

  const completed = Boolean(data?.onboarding_completed_at);

  let companyName = "";
  let customerType: CustomerType = "supermarket";
  try {
    const orgId = await requireOrgId();
    const { data: org } = await supabase
      .from("organizations")
      .select("name, customer_type, industry")
      .eq("id", orgId)
      .maybeSingle();
    companyName = org?.name ?? "";
    customerType = normalizeCustomerType(
      (org as { customer_type?: string | null })?.customer_type ?? org?.industry,
    );
  } catch {
    companyName = "";
  }

  const jobTitle = data?.job_title ?? "";
  const roleFamily =
    data?.role_family != null && String(data.role_family).trim()
      ? (data.role_family as RoleFamily)
      : inferRoleFamily(jobTitle, customerType);

  return {
    completed,
    full_name: data?.full_name ?? "",
    job_title: jobTitle,
    company_name: companyName,
    customer_type: customerType,
    role_family: roleFamily,
  };
}


/** Step 1 — profile details. Company name is written to the active org. */
export async function saveOnboardingProfile(input: {
  full_name: string;
  job_title: string;
  company_name: string;
  customer_type?: CustomerType;
  role_family?: RoleFamily;
}): Promise<void> {
  const userId = await requireUserId();
  const customerType = input.customer_type
    ? normalizeCustomerType(input.customer_type)
    : undefined;
  const roleFamily =
    input.role_family ??
    inferRoleFamily(input.job_title, customerType ?? "supermarket");

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      job_title: input.job_title.trim(),
      role_family: roleFamily,
    } as never)
    .eq("id", userId);
  if (error) dbError(error, "Could not save your profile details.");

  try {
    const orgId = await requireOrgId();
    const orgPatch: Record<string, unknown> = {};
    const companyName = input.company_name.trim();
    if (companyName) orgPatch.name = companyName;
    if (customerType) {
      orgPatch.customer_type = customerType;
      orgPatch.industry = customerType;
    }
    if (Object.keys(orgPatch).length) {
      await supabase.from("organizations").update(orgPatch as never).eq("id", orgId);
    }
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

