/**
 * Audit template builder — custom audit engine with field definitions, rules, and versioning.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type {
export type { TemplateStatus };
  AiConfig,
  AuditLevel,
  BuilderTemplateType,
  CalculatedFieldDef,
  EvidenceConfig,
  ScoringConfig,
  TemplateDefinition,
  TemplateField,
  TemplateRule,
  TemplateSection,
  TemplateStatus,
  TemplateVersion,
  WorkflowSettings,
} from "@/lib/audit-builder/types";
import type { AuditMode, ScopeType, ScopeValues } from "@/lib/assignments";
export type { TemplateStatus };

export type TemplateType = BuilderTemplateType;

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
  status: TemplateStatus;
  category: string | null;
  icon: string | null;
  audit_level: AuditLevel;
  is_active: boolean;
  sections: TemplateSection[];
  field_definitions: TemplateField[];
  rules: TemplateRule[];
  workflow_settings: WorkflowSettings;
  scoring_config: ScoringConfig;
  ai_config: AiConfig;
  evidence_config: EvidenceConfig;
  calculated_fields: CalculatedFieldDef[];
  created_by: string | null;
  updated_by: string | null;
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
  status?: TemplateStatus;
  category?: string;
  icon?: string;
  audit_level?: AuditLevel;
  is_active?: boolean;
  sections?: TemplateSection[];
  field_definitions?: TemplateField[];
  rules?: TemplateRule[];
  workflow_settings?: WorkflowSettings;
  scoring_config?: ScoringConfig;
  ai_config?: AiConfig;
  evidence_config?: EvidenceConfig;
  calculated_fields?: CalculatedFieldDef[];
};

export type TemplateListFilters = {
  search?: string;
  status?: TemplateStatus | "all";
  templateType?: string;
  activeOnly?: boolean;
};

export const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "shelf_audit", label: "Shelf Audit" },
  { value: "inventory_audit", label: "Inventory Audit" },
  { value: "fnv_qc_audit", label: "FNV QC Audit" },
  { value: "expiry_audit", label: "Expiry Audit" },
  { value: "store_visit_audit", label: "Store Visit Audit" },
  { value: "warehouse_audit", label: "Warehouse Audit" },
  { value: "distributor_audit", label: "Distributor Audit" },
  { value: "planogram_audit", label: "Planogram Audit" },
  { value: "promotion_audit", label: "Promotion Audit" },
  { value: "custom", label: "Custom Audit" },
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
    status: (row.status as TemplateStatus) ?? (row.published ? "published" : "draft"),
    category: (row.category as string) ?? null,
    icon: (row.icon as string) ?? null,
    audit_level: (row.audit_level as AuditLevel) ?? "one_per_audit",
    is_active: row.is_active !== false,
    sections: (row.sections as TemplateSection[]) ?? [],
    field_definitions: (row.field_definitions as TemplateField[]) ?? [],
    rules: (row.rules as TemplateRule[]) ?? [],
    workflow_settings: (row.workflow_settings as WorkflowSettings) ?? {},
    scoring_config: (row.scoring_config as ScoringConfig) ?? {},
    ai_config: (row.ai_config as AiConfig) ?? {},
    evidence_config: (row.evidence_config as EvidenceConfig) ?? {},
    calculated_fields: (row.calculated_fields as CalculatedFieldDef[]) ?? [],
    created_by: (row.created_by as string) ?? null,
    updated_by: (row.updated_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function templateToDefinition(t: AuditTemplate): TemplateDefinition {
  return {
    sections: t.sections,
    fields: t.field_definitions,
    rules: t.rules,
    workflow: t.workflow_settings,
    scoring: t.scoring_config,
    ai: t.ai_config,
    evidence: t.evidence_config,
    calculatedFields: t.calculated_fields,
    auditLevel: t.audit_level,
  };
}

export function definitionToPatch(def: TemplateDefinition): Partial<AuditTemplateInput> {
  return {
    sections: def.sections,
    field_definitions: def.fields,
    rules: def.rules,
    workflow_settings: def.workflow,
    scoring_config: def.scoring,
    ai_config: def.ai,
    evidence_config: def.evidence,
    calculated_fields: def.calculatedFields,
    audit_level: def.auditLevel,
  };
}

export async function fetchAuditTemplates(
  filters?: TemplateListFilters,
): Promise<AuditTemplate[]> {
  const orgId = await requireOrgId();
  let query = supabase
    .from("audit_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.templateType) {
    query = query.eq("template_type", filters.templateType);
  }
  if (filters?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load templates.");
  }

  let rows = (data ?? []).map(mapRow);
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.category?.toLowerCase().includes(q) ?? false),
    );
  }
  return rows;
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
      template_type: input.template_type ?? "custom",
      audit_mode: input.audit_mode ?? "digital",
      scope_type: input.scope_type ?? "category",
      scope_values: input.scope_values ?? {},
      instructions: input.instructions?.trim() || null,
      evidence_required: input.evidence_required ?? true,
      published: false,
      status: "draft",
      category: input.category?.trim() || null,
      icon: input.icon ?? "clipboard",
      audit_level: input.audit_level ?? "one_per_audit",
      sections: input.sections ?? [{ key: "default", title: "Audit Form", order: 0 }],
      field_definitions: input.field_definitions ?? [],
      rules: input.rules ?? [],
      workflow_settings: input.workflow_settings ?? { submission: "manager_approval" },
      scoring_config: input.scoring_config ?? { enabled: false },
      ai_config: input.ai_config ?? { enabled: false, features: {} },
      evidence_config: input.evidence_config ?? { photoRequired: true },
      calculated_fields: input.calculated_fields ?? [],
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42P01") {
      throw new Error("Templates are not available yet. Apply the audit builder migration.");
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
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.template_type !== undefined) patch.template_type = input.template_type;
  if (input.audit_mode !== undefined) patch.audit_mode = input.audit_mode;
  if (input.scope_type !== undefined) patch.scope_type = input.scope_type;
  if (input.scope_values !== undefined) patch.scope_values = input.scope_values;
  if (input.instructions !== undefined) patch.instructions = input.instructions?.trim() || null;
  if (input.evidence_required !== undefined) patch.evidence_required = input.evidence_required;
  if (input.status !== undefined) patch.status = input.status;
  if (input.category !== undefined) patch.category = input.category?.trim() || null;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.audit_level !== undefined) patch.audit_level = input.audit_level;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.sections !== undefined) patch.sections = input.sections;
  if (input.field_definitions !== undefined) patch.field_definitions = input.field_definitions;
  if (input.rules !== undefined) patch.rules = input.rules;
  if (input.workflow_settings !== undefined) patch.workflow_settings = input.workflow_settings;
  if (input.scoring_config !== undefined) patch.scoring_config = input.scoring_config;
  if (input.ai_config !== undefined) patch.ai_config = input.ai_config;
  if (input.evidence_config !== undefined) patch.evidence_config = input.evidence_config;
  if (input.calculated_fields !== undefined) patch.calculated_fields = input.calculated_fields;

  const { error } = await supabase
    .from("audit_templates")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not update template.");
}

export async function duplicateAuditTemplate(id: string): Promise<AuditTemplate> {
  const source = await fetchAuditTemplate(id);
  if (!source) throw new Error("Template not found.");
  return createAuditTemplate({
    name: `${source.name} — Copy`,
    description: source.description ?? undefined,
    template_type: source.template_type,
    audit_mode: source.audit_mode,
    scope_type: source.scope_type,
    scope_values: source.scope_values,
    instructions: source.instructions ?? undefined,
    evidence_required: source.evidence_required,
    category: source.category ?? undefined,
    icon: source.icon ?? undefined,
    audit_level: source.audit_level,
    sections: source.sections,
    field_definitions: source.field_definitions,
    rules: source.rules,
    workflow_settings: source.workflow_settings,
    scoring_config: source.scoring_config,
    ai_config: source.ai_config,
    evidence_config: source.evidence_config,
    calculated_fields: source.calculated_fields,
  });
}

export async function archiveAuditTemplate(id: string): Promise<void> {
  await updateAuditTemplate(id, { status: "archived", is_active: false });
}

export async function deleteAuditTemplate(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("audit_templates").delete().eq("org_id", orgId).eq("id", id);
  if (error) dbError(error, "Could not delete template.");
}

export async function publishAuditTemplate(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("publish_audit_template", {
    p_template_id: id,
  });
  if (error) {
    /* fallback for environments without RPC */
    const orgId = await requireOrgId();
    const userId = await requireUserId();
    const { data: current } = await supabase
      .from("audit_templates")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    const nextVersion = (Number(current?.version) || 0) + 1;
    const { error: updErr } = await supabase
      .from("audit_templates")
      .update({
        published: true,
        status: "published",
        version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("org_id", orgId)
      .eq("id", id);
    if (updErr) dbError(updErr, "Could not publish template.");
    if (current) {
      await supabase.from("audit_template_versions").insert({
        template_id: id,
        org_id: orgId,
        version: nextVersion,
        snapshot: current,
        change_summary: `Published ${String(current.name)} as v${nextVersion}`,
        created_by: userId,
      });
    }
    return nextVersion;
  }
  return Number(data) || 1;
}

export async function fetchTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_template_versions")
    .select("*")
    .eq("org_id", orgId)
    .eq("template_id", templateId)
    .order("version", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load version history.");
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    template_id: row.template_id as string,
    version: Number(row.version),
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
    change_summary: (row.change_summary as string) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string) ?? null,
  }));
}

export async function seedFnvQcTemplate(): Promise<string | null> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("seed_fnv_qc_template", { p_org_id: orgId });
  if (error) {
    if (error.code === "42883") return null;
    dbError(error, "Could not seed FNV QC template.");
  }
  return (data as string) ?? null;
}

export function isCustomBuilderTemplate(t: AuditTemplate): boolean {
  return t.field_definitions.length > 0 || t.sections.length > 1;
}
