/**
 * Server-side schedule runner — replaces client-triggered schedule processing.
 * pg_cron or the schedule-runner Edge Function call the same RPCs.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";

export type SchedulerRunResult = {
  schedulesProcessed: number;
  assignmentsCreated: number;
  remindersSent?: number;
  source: "rpc" | "legacy";
};

export async function runServerScheduleProcessor(
  limit = 200,
): Promise<SchedulerRunResult> {
  const { data, error } = await supabase.rpc("process_due_audit_schedules", {
    p_limit: limit,
  });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return { schedulesProcessed: 0, assignmentsCreated: 0, source: "legacy" };
    }
    dbError(error, "Could not process due audit schedules.");
  }

  const result = (data ?? {}) as {
    schedules_processed?: number;
    assignments_created?: number;
  };

  return {
    schedulesProcessed: result.schedules_processed ?? 0,
    assignmentsCreated: result.assignments_created ?? 0,
    source: "rpc",
  };
}

export async function runServerReminderProcessor(limit = 500): Promise<number> {
  const { data, error } = await supabase.rpc("process_assignment_reminders", {
    p_limit: limit,
  });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return 0;
    dbError(error, "Could not process assignment reminders.");
  }

  const result = (data ?? {}) as { reminders_sent?: number };
  return result.reminders_sent ?? 0;
}

/** Manager manual trigger — runs server RPC only (no client-side duplicate generation). */
export async function triggerScheduleRun(): Promise<SchedulerRunResult> {
  const scheduleResult = await runServerScheduleProcessor();
  const remindersSent = await runServerReminderProcessor();
  return { ...scheduleResult, remindersSent };
}
