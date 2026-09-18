/**
 * Shared demo environment — isolated showcase org for new users with no real audit activity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

/** Fixed demo org id (matches supabase migration aislix_demo_org_id). */
export const AISLIX_DEMO_ORG_ID = "d0000000-0000-4000-8000-000000000001";

export const DEMO_DATA_LABEL = "DEMO DATA";
export const DEMO_CTA = "Start your first audit to see your real performance.";
export const DEMO_ASK_PREFIX = "Based on demo data";

export type DemoExperienceMode = {
  /** When true, KPIs/charts should show DEMO DATA badge and CTA. */
  labeledDemo: boolean;
  /** Org id used for KPI/audit queries (may differ from active org for new users). */
  dataOrgId: string;
  /** User's actual active org. */
  activeOrgId: string;
};

export async function fetchOrgIsDemo(orgId: string): Promise<boolean> {
  const { data } = await supabase.from("organizations").select("is_demo").eq("id", orgId).maybeSingle();
  return Boolean(data?.is_demo);
}

export async function orgHasRealAuditActivity(orgId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["completed", "in_progress"]);

  if (error) {
    const { data } = await supabase.rpc("org_has_real_audit_activity" as never, {
      p_org_id: orgId,
    } as never);
    return Boolean(data);
  }
  return (count ?? 0) > 0;
}

/** Resolve whether to show demo-labeled data from the showcase org. */
export async function resolveDemoExperience(activeOrgId: string): Promise<DemoExperienceMode> {
  const isDemoOrg = await fetchOrgIsDemo(activeOrgId);
  if (isDemoOrg) {
    return { labeledDemo: true, dataOrgId: activeOrgId, activeOrgId };
  }

  const hasActivity = await orgHasRealAuditActivity(activeOrgId);
  if (!hasActivity) {
    return { labeledDemo: true, dataOrgId: AISLIX_DEMO_ORG_ID, activeOrgId };
  }

  return { labeledDemo: false, dataOrgId: activeOrgId, activeOrgId };
}

export function prefixDemoAnswer(answer: string, labeledDemo: boolean): string {
  if (!labeledDemo) return answer;
  const trimmed = answer.trim();
  if (trimmed.toLowerCase().startsWith(DEMO_ASK_PREFIX.toLowerCase())) return trimmed;
  return `${DEMO_ASK_PREFIX}: ${trimmed}`;
}

/** Server/client — pass an explicit Supabase client (e.g. route handler). */
export async function resolveDemoExperienceWithClient(
  client: SupabaseClient<Database>,
  activeOrgId: string,
): Promise<DemoExperienceMode> {
  const { data: org } = await client
    .from("organizations")
    .select("is_demo")
    .eq("id", activeOrgId)
    .maybeSingle();
  const isDemoOrg = Boolean(org?.is_demo);
  if (isDemoOrg) {
    return { labeledDemo: true, dataOrgId: activeOrgId, activeOrgId };
  }

  const { count } = await client
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", activeOrgId)
    .in("status", ["completed", "in_progress"]);

  if ((count ?? 0) === 0) {
    return { labeledDemo: true, dataOrgId: AISLIX_DEMO_ORG_ID, activeOrgId };
  }

  return { labeledDemo: false, dataOrgId: activeOrgId, activeOrgId };
}
