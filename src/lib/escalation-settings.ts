import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { FindingSeverity } from "@/lib/findings";
import { SLA_TYPES, type SlaType } from "@/lib/sla-insights";

export type SlaDefaults = {
  org_id: string;
  critical_hours: number;
  high_hours: number;
  medium_hours: number;
  low_hours: number;
};

export type EscalationRule = {
  id: string;
  org_id: string;
  severity: FindingSeverity;
  first_role: string;
  escalate_after_hours: number;
  second_role: string;
  second_after_hours: number;
  final_role: string;
  notify_in_app: boolean;
};

const DEFAULT_SLA: Omit<SlaDefaults, "org_id"> = {
  critical_hours: 4,
  high_hours: 12,
  medium_hours: 24,
  low_hours: 72,
};

const DEFAULT_RULES: Omit<EscalationRule, "id" | "org_id">[] = [
  { severity: "critical", first_role: "member", escalate_after_hours: 4, second_role: "store_manager", second_after_hours: 8, final_role: "admin", notify_in_app: true },
  { severity: "high", first_role: "member", escalate_after_hours: 12, second_role: "store_manager", second_after_hours: 24, final_role: "manager", notify_in_app: true },
  { severity: "medium", first_role: "member", escalate_after_hours: 24, second_role: "store_manager", second_after_hours: 48, final_role: "manager", notify_in_app: true },
  { severity: "low", first_role: "member", escalate_after_hours: 72, second_role: "store_manager", second_after_hours: 96, final_role: "manager", notify_in_app: true },
];

export const ESCALATION_ROLES = [
  { value: "member", label: "Auditor / employee" },
  { value: "store_manager", label: "Store manager" },
  { value: "manager", label: "Regional manager" },
  { value: "admin", label: "Admin" },
];

export async function fetchSlaDefaults(): Promise<SlaDefaults> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.from("org_sla_defaults").select("*").eq("org_id", orgId).maybeSingle();
  if (error && error.code !== "42P01" && error.code !== "PGRST116") {
    dbError(error, "Could not load SLA defaults.");
  }
  if (!data) return { org_id: orgId, ...DEFAULT_SLA };
  return {
    org_id: orgId,
    critical_hours: Number(data.critical_hours) || 4,
    high_hours: Number(data.high_hours) || 12,
    medium_hours: Number(data.medium_hours) || 24,
    low_hours: Number(data.low_hours) || 72,
  };
}

export async function saveSlaDefaults(input: Omit<SlaDefaults, "org_id">): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("org_sla_defaults").upsert({
    org_id: orgId,
    ...input,
    updated_at: new Date().toISOString(),
  });
  if (error) dbError(error, "Could not save SLA defaults.");
}

/** Target per SLA type; `store_id` null is the workspace default, a store id overrides it. */
export type SlaPolicy = { store_id: string | null; sla_type: SlaType; target_minutes: number };

export async function fetchSlaPolicies(): Promise<SlaPolicy[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("org_sla_policies" as never)
    .select("store_id, sla_type, target_minutes")
    .eq("org_id", orgId);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load SLA targets.");
  }
  return ((data ?? []) as unknown as SlaPolicy[]).map((p) => ({
    store_id: p.store_id ?? null,
    sla_type: p.sla_type,
    target_minutes: Number(p.target_minutes),
  }));
}

/** Workspace or store target, falling back to the built-in default. */
export function effectiveSlaTarget(policies: SlaPolicy[], slaType: SlaType, storeId: string | null = null): number {
  const store = storeId ? policies.find((p) => p.store_id === storeId && p.sla_type === slaType) : undefined;
  const org = policies.find((p) => p.store_id == null && p.sla_type === slaType);
  return (store ?? org)?.target_minutes ?? SLA_TYPES.find((t) => t.value === slaType)!.defaultMinutes;
}

export async function saveSlaPolicy(policy: SlaPolicy): Promise<void> {
  const orgId = await requireOrgId();
  const minutes = Math.round(policy.target_minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 43200) {
    throw new Error("SLA targets must be between 1 minute and 30 days.");
  }
  const { error } = await supabase.from("org_sla_policies" as never).upsert(
    {
      org_id: orgId,
      store_id: policy.store_id,
      sla_type: policy.sla_type,
      target_minutes: minutes,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "org_id,scope_key,sla_type" },
  );
  if (error) dbError(error, "Could not save the SLA target.");
}

export async function fetchOrgStores(): Promise<{ id: string; name: string }[]> {
  const orgId = await requireOrgId();
  const { data } = await supabase.from("stores").select("id, name").eq("org_id", orgId).order("name");
  return (data ?? []).map((s) => ({ id: s.id as string, name: (s.name as string) || "Store" }));
}

export async function deleteSlaPolicy(storeId: string, slaType: SlaType): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("org_sla_policies" as never)
    .delete()
    .eq("org_id", orgId)
    .eq("store_id", storeId)
    .eq("sla_type", slaType);
  if (error) dbError(error, "Could not remove the store SLA target.");
}

export async function fetchEscalationRules(): Promise<EscalationRule[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.from("escalation_rules").select("*").eq("org_id", orgId);
  if (error) {
    if (error.code === "42P01") {
      return DEFAULT_RULES.map((rule, i) => ({ id: `default-${i}`, org_id: orgId, ...rule }));
    }
    dbError(error, "Could not load escalation rules.");
  }
  if (!data?.length) {
    return DEFAULT_RULES.map((rule, i) => ({ id: `default-${i}`, org_id: orgId, ...rule }));
  }
  return data.map((row) => ({
    id: row.id as string,
    org_id: orgId,
    severity: row.severity as FindingSeverity,
    first_role: String(row.first_role),
    escalate_after_hours: Number(row.escalate_after_hours),
    second_role: String(row.second_role),
    second_after_hours: Number(row.second_after_hours),
    final_role: String(row.final_role),
    notify_in_app: Boolean(row.notify_in_app),
  }));
}

export async function saveEscalationRule(rule: EscalationRule): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("escalation_rules").upsert({
    id: rule.id.startsWith("default-") ? undefined : rule.id,
    org_id: orgId,
    severity: rule.severity,
    first_role: rule.first_role,
    escalate_after_hours: rule.escalate_after_hours,
    second_role: rule.second_role,
    second_after_hours: rule.second_after_hours,
    final_role: rule.final_role,
    notify_in_app: rule.notify_in_app,
    updated_at: new Date().toISOString(),
  });
  if (error) dbError(error, "Could not save escalation rule.");
}
