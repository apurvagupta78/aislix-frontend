/**
 * Audit template builder — saved scope presets for assignments.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type { AuditMode, ScopeType, ScopeValues } from "@/lib/assignments";

export type TemplateType =
  | "shelf_audit"
  | "inventory_audit"
  | "planogram_audit"
  | "pricing_audit"
  | "checklist_audit"
  | "custom";

export type AuditTemplate = {
  id: string;
  name: string;
  description: string | null;
  template_type: TemplateType;
  audit_mode: AuditMode;
  scope_type: ScopeType;
  scope_values: ScopeValues;
  instructions: string | null;
  evidence_required: boolean;
  version: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditTemplateInput = {
  name: string;
  description?: string;
  template_type?: TemplateType;
  audit_mode?: AuditMode;
  scope_type?: ScopeType;
  scope_values?: ScopeValues;
  instructions?: string;
  evidence_required?: boolean;
  published?: boolean;
};

export const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "shelf_audit", label: "Shelf Audit" },
  { value: "inventory_audit", label: "Inventory Audit" },
  { value: "planogram_audit", label: "Planogram Audit" },
  { value: "pricing_audit", label: "Promotion/Pricing Audit" },
  { value: "checklist_audit", label: "Custom Checklist Audit" },
  { value: "custom", label: "Custom" },
];

function mapRow(row: Record<string, unknown>): AuditTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    template_type: row.template_type as TemplateType,
    audit_mode: row.audit_mode as AuditMode,
    scope_type: row.scope_type as ScopeType,
    scope_values: (row.scope_values as ScopeValues) ?? {},
    instructions: (row.instructions as string) ?? null,
    evidence_required: Boolean(row.evidence_required),
    version: Number(row.version) || 1,
    published: Boolean(row.published),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function fetchAuditTemplates(): Promise<AuditTemplate[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load templates.");
  }
  return (data ?? []).map(mapRow);
}

export async function fetchAuditTemplate(id: string): Promise<AuditTemplate | null> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    dbError(error, "Could not load template.");
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function createAuditTemplate(input: AuditTemplateInput): Promise<AuditTemplate> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("audit_templates")
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      template_type: input.template_type ?? "shelf_audit",
      audit_mode: input.audit_mode ?? "digital",
      scope_type: input.scope_type ?? "planogram",
      scope_values: input.scope_values ?? {},
      instructions: input.instructions?.trim() || null,
      evidence_required: input.evidence_required ?? true,
      published: input.published ?? false,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42P01") {
      throw new Error("Templates are not available yet. Apply the audit_templates migration.");
    }
    dbError(error, "Could not create template.");
  }
  return mapRow(data as Record<string, unknown>);
}

export async function updateAuditTemplate(
  id: string,
  input: Partial<AuditTemplateInput>,
): Promise<void> {
  const orgId = await requireOrgId();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.template_type !== undefined) patch.template_type = input.template_type;
  if (input.audit_mode !== undefined) patch.audit_mode = input.audit_mode;
  if (input.scope_type !== undefined) patch.scope_type = input.scope_type;
  if (input.scope_values !== undefined) patch.scope_values = input.scope_values;
  if (input.instructions !== undefined) patch.instructions = input.instructions?.trim() || null;
  if (input.evidence_required !== undefined) patch.evidence_required = input.evidence_required;
  if (input.published !== undefined) patch.published = input.published;

  const { error } = await supabase
    .from("audit_templates")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not update template.");
}

export async function deleteAuditTemplate(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("audit_templates").delete().eq("org_id", orgId).eq("id", id);
  if (error) dbError(error, "Could not delete template.");
}

export async function publishAuditTemplate(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { data: current } = await supabase
    .from("audit_templates")
    .select("version")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  const nextVersion = (Number(current?.version) || 0) + 1;
  const { error } = await supabase
    .from("audit_templates")
    .update({
      published: true,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not publish template.");
}
