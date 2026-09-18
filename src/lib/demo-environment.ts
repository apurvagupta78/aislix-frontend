/**
 * Shared demo environment — isolated showcase org for new users with no real audit activity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { hasPlatformBypass } from "@/lib/subscription-limits";

/** Fixed demo org id (matches supabase migration aislix_demo_org_id). */
export const AISLIX_DEMO_ORG_ID = "d0000000-0000-4000-8000-000000000001";

export const DEMO_DATA_LABEL = "DEMO DATA";
export const DEMO_CTA = "Start your first audit to see your real performance.";
export const DEMO_PREVIEW_CTA = "Turn off preview to return to your real workspace data.";
export const DEMO_ASK_PREFIX = "Based on demo data";
export const DEMO_PREVIEW_STORAGE_KEY = "aislix:demo-preview-enabled";

export type DemoExperienceMode = {
  /** When true, KPIs/charts should show DEMO DATA badge and CTA. */
  labeledDemo: boolean;
  /** Org id used for KPI/audit queries (may differ from active org for new users). */
  dataOrgId: string;
  /** User's actual active org. */
  activeOrgId: string;
  /** Explicit owner preview toggle (not auto new-user showcase). */
  previewDemo?: boolean;
};

export type DemoExperienceOptions = {
  previewDemo?: boolean;
  userEmail?: string | null;
};

export function isDemoOrgId(orgId: string): boolean {
  return orgId === AISLIX_DEMO_ORG_ID;
}

export function canUseDemoPreview(userEmail?: string | null): boolean {
  return hasPlatformBypass(userEmail);
}

export function readDemoPreviewPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_PREVIEW_STORAGE_KEY) === "1";
}

export function writeDemoPreviewPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_PREVIEW_STORAGE_KEY, enabled ? "1" : "0");
}

function resolveShowcaseExperience(activeOrgId: string, previewDemo: boolean): DemoExperienceMode {
  return {
    labeledDemo: true,
    dataOrgId: AISLIX_DEMO_ORG_ID,
    activeOrgId,
    previewDemo,
  };
}

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
export async function resolveDemoExperience(
  activeOrgId: string,
  options: DemoExperienceOptions = {},
): Promise<DemoExperienceMode> {
  const isDemoOrg = (await fetchOrgIsDemo(activeOrgId)) || isDemoOrgId(activeOrgId);
  if (isDemoOrg) {
    return { labeledDemo: true, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
  }

  if (options.previewDemo && canUseDemoPreview(options.userEmail)) {
    return resolveShowcaseExperience(activeOrgId, true);
  }

  const hasActivity = await orgHasRealAuditActivity(activeOrgId);
  if (!hasActivity) {
    return resolveShowcaseExperience(activeOrgId, false);
  }

  return { labeledDemo: false, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
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
  options: DemoExperienceOptions = {},
): Promise<DemoExperienceMode> {
  const { data: org } = await client
    .from("organizations")
    .select("is_demo")
    .eq("id", activeOrgId)
    .maybeSingle();
  const isDemoOrg = Boolean(org?.is_demo) || isDemoOrgId(activeOrgId);
  if (isDemoOrg) {
    return { labeledDemo: true, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
  }

  if (options.previewDemo && canUseDemoPreview(options.userEmail)) {
    return resolveShowcaseExperience(activeOrgId, true);
  }

  const { count } = await client
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", activeOrgId)
    .in("status", ["completed", "in_progress"]);

  if ((count ?? 0) === 0) {
    return resolveShowcaseExperience(activeOrgId, false);
  }

  return { labeledDemo: false, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
}
