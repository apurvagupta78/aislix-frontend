/**
 * Audit digest delivery settings — email and WhatsApp summaries for managers.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import { fetchExecutiveScorecards } from "@/lib/audit-executive";
import { fetchExceptions } from "@/lib/exceptions";

export type DigestCadence = "daily" | "weekly";

export type AuditDigestSettings = {
  org_id: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  cadence: DigestCadence;
  send_time_local: string;
  timezone: string;
  include_exceptions: boolean;
  include_variance_summary: boolean;
  include_pending_approvals: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  updated_at: string;
};

export type DigestPreview = {
  subject: string;
  lines: string[];
  generated_at: string;
};

const DEFAULTS: Omit<AuditDigestSettings, "org_id" | "updated_at"> = {
  email_enabled: true,
  whatsapp_enabled: false,
  whatsapp_number: null,
  cadence: "daily",
  send_time_local: "08:00",
  timezone: "Asia/Kolkata",
  include_exceptions: true,
  include_variance_summary: true,
  include_pending_approvals: true,
  last_sent_at: null,
  last_status: null,
};

export async function fetchAuditDigestSettings(): Promise<AuditDigestSettings> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_digest_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error && error.code !== "PGRST116" && error.code !== "42P01") {
    dbError(error, "Could not load digest settings.");
  }

  if (!data) {
    return { org_id: orgId, ...DEFAULTS, updated_at: new Date().toISOString() };
  }

  return data as AuditDigestSettings;
}

export async function updateAuditDigestSettings(
  input: Partial<Omit<AuditDigestSettings, "org_id" | "updated_at">>,
): Promise<AuditDigestSettings> {
  const orgId = await requireOrgId();
  const patch = { ...input, org_id: orgId, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("audit_digest_settings")
    .upsert(patch, { onConflict: "org_id" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Digest settings are not available yet. Apply the audit_digest_settings migration.");
    }
    dbError(error, "Could not save digest settings.");
  }

  return data as AuditDigestSettings;
}

/** Build a preview of what the next digest would contain (no send). */
export async function previewAuditDigest(): Promise<DigestPreview> {
  const [scorecards, exceptions] = await Promise.all([
    fetchExecutiveScorecards(7),
    fetchExceptions({ lifecycle: "open" }),
  ]);

  const lines: string[] = [
    `Audits assigned (7d): ${scorecards.assigned}`,
    `Submitted: ${scorecards.submitted} · Approved: ${scorecards.approved}`,
    `Pending approvals: ${scorecards.pending_approvals}`,
    `Overdue audits: ${scorecards.overdue}`,
    `Signed variance (7d): ₹${Math.abs(scorecards.signed_variance_inr).toLocaleString("en-IN")} (observation vs baseline, not confirmed loss)`,
    `Open exceptions: ${exceptions.length}`,
    `Open corrective actions: ${scorecards.open_corrective_actions}`,
  ];

  const critical = exceptions.filter((e) => e.severity === "critical").slice(0, 3);
  for (const ex of critical) {
    lines.push(`Critical: ${ex.store_name} · ${ex.sku_label} · ${ex.title}`);
  }

  return {
    subject: `Aislix audit digest — ${new Date().toLocaleDateString("en-IN")}`,
    lines,
    generated_at: new Date().toISOString(),
  };
}

/** Record a manual "send now" attempt (actual email/WhatsApp via backend cron later). */
export async function markDigestSent(status: string): Promise<void> {
  const orgId = await requireOrgId();
  await supabase
    .from("audit_digest_settings")
    .upsert(
      {
        org_id: orgId,
        last_sent_at: new Date().toISOString(),
        last_status: status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );
}
