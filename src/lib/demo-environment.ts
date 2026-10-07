/**
 * Shared demo environment — isolated showcase org, shown only when Demo Data is on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

/** Fixed demo org id (matches supabase migration aislix_demo_org_id). */
export const AISLIX_DEMO_ORG_ID = "d0000000-0000-4000-8000-000000000001";

/**
 * People hierarchy for the showcase org is seeded by
 * `seed_demo_people_hierarchy()` (migration 20260922170000): Owner →
 * North/South managers → auditors, with distinct store_ids and reports_to.
 * Demo-only emails use `@aislix.demo` (e.g. demo.north.manager@aislix.demo).
 */
export const DEMO_PEOPLE_HIERARCHY_NOTE =
  "Demo org members include North/South managers and auditors under the demo owner.";

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
  /** @deprecated The toggle is always honoured; kept so existing callers compile. */
  honorPreviewOff?: boolean;
};

export function isDemoOrgId(orgId: string): boolean {
  return orgId === AISLIX_DEMO_ORG_ID;
}

/** Demo Data toggle is available to all signed-in users on dashboard surfaces. */
export function canUseDemoPreview(_userEmail?: string | null): boolean {
  return true;
}

/** Default OFF: a new workspace sees its own data until the user turns Demo Data on. */
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

/**
 * The Demo Data toggle is the only way to see showcase numbers. With it off, a workspace
 * always sees its own data — an empty workspace shows N/A, never borrowed demo figures.
 */
export function decideDemoExperience(
  activeOrgId: string,
  isDemoOrg: boolean,
  options: DemoExperienceOptions = {},
): DemoExperienceMode {
  if (isDemoOrg || isDemoOrgId(activeOrgId)) {
    return { labeledDemo: true, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
  }
  if (options.previewDemo === true && canUseDemoPreview(options.userEmail)) {
    return resolveShowcaseExperience(activeOrgId, true);
  }
  return { labeledDemo: false, dataOrgId: activeOrgId, activeOrgId, previewDemo: false };
}

/** Resolve whether to show demo-labeled data from the showcase org. */
export async function resolveDemoExperience(
  activeOrgId: string,
  options: DemoExperienceOptions = {},
): Promise<DemoExperienceMode> {
  const isDemoOrg = isDemoOrgId(activeOrgId) || (await fetchOrgIsDemo(activeOrgId));
  return decideDemoExperience(activeOrgId, isDemoOrg, options);
}

/** Use preview overlay CTA when demo data comes from the owner preview toggle, not the demo workspace. */
export function shouldShowDemoPreviewCta(previewDemo?: boolean): boolean {
  return Boolean(previewDemo);
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
  return decideDemoExperience(activeOrgId, Boolean(org?.is_demo), options);
}
