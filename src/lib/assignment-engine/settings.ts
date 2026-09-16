/**
 * Org-level assignment capacity and reminder configuration.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { OrgAssignmentSettings } from "./types";

const DEFAULT_REMINDER_HOURS = [24, 12, 4, 1];

export async function fetchOrgAssignmentSettings(): Promise<OrgAssignmentSettings> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("org_assignment_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return { reminderHours: DEFAULT_REMINDER_HOURS, blockOnConflict: false };
    }
    dbError(error, "Could not load assignment settings.");
  }

  if (!data) {
    return { reminderHours: DEFAULT_REMINDER_HOURS, blockOnConflict: false };
  }

  return {
    maxDailyAssignmentsPerEmployee: data.max_daily_assignments_per_employee as number | null,
    maxConcurrentAudits: data.max_concurrent_audits as number | null,
    estimatedAuditDurationMinutes: data.estimated_audit_duration_minutes as number | null,
    reminderHours: (data.reminder_hours as number[]) ?? DEFAULT_REMINDER_HOURS,
    blockOnConflict: Boolean(data.block_on_conflict),
    escalationUserId: (data.escalation_user_id as string) ?? null,
  };
}

export async function saveOrgAssignmentSettings(
  settings: OrgAssignmentSettings & { escalationUserId?: string | null },
): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("org_assignment_settings").upsert(
    {
      org_id: orgId,
      max_daily_assignments_per_employee: settings.maxDailyAssignmentsPerEmployee ?? null,
      max_concurrent_audits: settings.maxConcurrentAudits ?? null,
      estimated_audit_duration_minutes: settings.estimatedAuditDurationMinutes ?? null,
      reminder_hours: settings.reminderHours,
      block_on_conflict: settings.blockOnConflict,
      escalation_user_id: settings.escalationUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Assignment settings not available. Apply universal assignment migration.");
    }
    dbError(error, "Could not save assignment settings.");
  }
}

export const REMINDER_HOUR_OPTIONS = [24, 12, 4, 1] as const;
