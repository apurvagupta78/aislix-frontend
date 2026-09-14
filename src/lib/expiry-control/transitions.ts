import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

export type TransitionEntity = "attempt" | "transfer" | "observation";

export async function expiryTransition(input: {
  entityType: TransitionEntity;
  entityId: string;
  action: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{ ok: boolean }> {
  await requireOrgId();
  const { data, error } = await supabase.rpc("expiry_transition", {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_action: input.action,
    p_payload: input.payload ?? {},
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) dbError(error, error.message || "Transition failed.");
  return (data as { ok: boolean }) ?? { ok: true };
}

export function makeIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
