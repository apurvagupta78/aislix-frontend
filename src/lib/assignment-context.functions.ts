/** Server function wrapper for assignment scan context. */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAssignmentScanContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string }) => {
    const assignmentId = typeof input?.assignmentId === "string" ? input.assignmentId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) throw new Error("A valid assignment id is required.");
    return { assignmentId };
  })
  .handler(async ({ data, context }) => {
    const { loadAssignmentScanContext } = await import("@/lib/assignment-context.server");
    return loadAssignmentScanContext(context.supabase, context.userId, data.assignmentId);
  });
