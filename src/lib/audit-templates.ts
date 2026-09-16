/**
 * Audit template builder — custom audit engine with field definitions, rules, and versioning.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type {
  AiConfig,
  AuditLevel,
  AuditPurpose,
  AuditSubjectType,
  BuilderTemplateType,
  CalculatedFieldDef,
  EvidenceConfig,
  OperatingModel,
  ScoringConfig,
  TemplateDefinition,
  TemplateField,
  TemplateRule,
  TemplateSection,
  TemplateStatus,
  TemplateVersion,
  TemplateVisibility,
  WorkflowSettings,
} from "@/lib/audit-builder/types";
import { ensureDefinitionFieldRoles, ensureFieldRoles } from "@/lib/audit-builder/ensure-field-roles";
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
  operating_model: OperatingModel | null;
  audit_purpose: AuditPurpose | null;
  subject_type: AuditSubjectType | null;
  hierarchy_profile_id: string | null;
  hierarchy_bindings: Record<string, string>;
  is_system_template: boolean;
  purpose_config: Record<string, unknown>;
  short_description: string | null;
  owner_user_id: string | null;
  visibility: TemplateVisibility;
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
  operating_model?: OperatingModel | null;
  audit_purpose?: AuditPurpose | null;
  subject_type?: AuditSubjectType | null;
  hierarchy_profile_id?: string | null;
  hierarchy_bindings?: Record<string, string>;
  is_system_template?: boolean;
  purpose_config?: Record<string, unknown>;
  short_description?: string | null;
  owner_user_id?: string | null;
  visibility?: TemplateVisibility;
};

export type TemplateListFilters = {
  search?: string;
  status?: TemplateStatus | "all";
  templateType?: string;
  operatingModel?: OperatingModel | "all";
  auditPurpose?: AuditPurpose | "all";
  aiEnabled?: boolean;
  evidenceRequired?: boolean;
  activeOnly?: boolean;
  /** Client-side filter after RLS — my private templates only */
  mineOnly?: boolean;
  visibility?: TemplateVisibility | "all";
  excludeSystem?: boolean;
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
    field_definitions: ensureFieldRoles((row.field_definitions as TemplateField[]) ?? []),
    rules: (row.rules as TemplateRule[]) ?? [],
    workflow_settings: (row.workflow_settings as WorkflowSettings) ?? {},
    scoring_config: (row.scoring_config as ScoringConfig) ?? {},
    ai_config: (row.ai_config as AiConfig) ?? {},
    evidence_config: (row.evidence_config as EvidenceConfig) ?? {},
    calculated_fields: (row.calculated_fields as CalculatedFieldDef[]) ?? [],
    operating_model: (row.operating_model as OperatingModel) ?? null,
    audit_purpose: (row.audit_purpose as AuditPurpose) ?? null,
    subject_type: (row.subject_type as AuditSubjectType) ?? null,
    hierarchy_profile_id: (row.hierarchy_profile_id as string) ?? null,
    hierarchy_bindings: (row.hierarchy_bindings as Record<string, string>) ?? {},
    is_system_template: Boolean(row.is_system_template),
    purpose_config: (row.purpose_config as Record<string, unknown>) ?? {},
    short_description: (row.short_description as string) ?? null,
    owner_user_id: (row.owner_user_id as string) ?? (row.created_by as string) ?? null,
    visibility: (row.visibility as TemplateVisibility) ?? "organization",
    created_by: (row.created_by as string) ?? null,
    updated_by: (row.updated_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function templateToDefinition(t: AuditTemplate): TemplateDefinition {
  return ensureDefinitionFieldRoles({
    sections: t.sections,
    fields: t.field_definitions,
    rules: t.rules,
    workflow: t.workflow_settings,
    scoring: t.scoring_config,
    ai: t.ai_config,
    evidence: t.evidence_config,
    calculatedFields: t.calculated_fields,
    auditLevel: t.audit_level,
    operatingModel: t.operating_model ?? undefined,
    purpose: t.audit_purpose ?? undefined,
    subjectType: t.subject_type ?? undefined,
    hierarchy: t.hierarchy_profile_id
      ? { definitionId: t.hierarchy_profile_id, levels: [] }
      : undefined,
    findingTypes: (t.purpose_config.findingTypes as string[]) ?? undefined,
    rcaOptions: (t.purpose_config.rcaOptions as string[]) ?? undefined,
    channels: (t.purpose_config.channels as string[]) ?? undefined,
    outletTypes: (t.purpose_config.outletTypes as string[]) ?? undefined,
  });
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
    operating_model: def.operatingModel ?? null,
    audit_purpose: def.purpose ?? null,
    subject_type: def.subjectType ?? null,
    hierarchy_profile_id: def.hierarchy?.definitionId ?? null,
    purpose_config: {
      findingTypes: def.findingTypes,
      rcaOptions: def.rcaOptions,
      channels: def.channels,
      outletTypes: def.outletTypes,
    },
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
  if (filters?.operatingModel && filters.operatingModel !== "all") {
    query = query.eq("operating_model", filters.operatingModel);
  }
  if (filters?.auditPurpose && filters.auditPurpose !== "all") {
    query = query.eq("audit_purpose", filters.auditPurpose);
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
        (t.short_description?.toLowerCase().includes(q) ?? false) ||
        (t.category?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters?.aiEnabled) {
    rows = rows.filter((t) => Boolean(t.ai_config?.enabled));
  }
  if (filters?.evidenceRequired) {
    rows = rows.filter((t) => t.evidence_required || Boolean(t.evidence_config?.photoRequired));
  }
  if (filters?.visibility && filters.visibility !== "all") {
    rows = rows.filter((t) => t.visibility === filters.visibility);
  }
  if (filters?.excludeSystem) {
    rows = rows.filter((t) => !t.is_system_template);
  }
  if (filters?.mineOnly) {
    const userId = await requireUserId();
    rows = rows.filter((t) => t.owner_user_id === userId && t.visibility === "private");
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
      field_definitions: ensureFieldRoles(input.field_definitions ?? []),
      rules: input.rules ?? [],
      workflow_settings: input.workflow_settings ?? { submission: "manager_approval" },
      scoring_config: input.scoring_config ?? { enabled: false },
      ai_config: input.ai_config ?? { enabled: false, features: {} },
      evidence_config: input.evidence_config ?? { photoRequired: true },
      calculated_fields: input.calculated_fields ?? [],
      operating_model: input.operating_model ?? null,
      audit_purpose: input.audit_purpose ?? null,
      subject_type: input.subject_type ?? null,
      hierarchy_profile_id: input.hierarchy_profile_id ?? null,
      hierarchy_bindings: input.hierarchy_bindings ?? {},
      is_system_template: input.is_system_template ?? false,
      purpose_config: input.purpose_config ?? {},
      short_description: input.short_description?.trim() || null,
      owner_user_id: input.owner_user_id ?? userId,
      visibility: input.is_system_template
        ? "organization"
        : (input.visibility ?? "private"),
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
  if (input.field_definitions !== undefined) {
    patch.field_definitions = ensureFieldRoles(input.field_definitions);
  }
  if (input.rules !== undefined) patch.rules = input.rules;
  if (input.workflow_settings !== undefined) patch.workflow_settings = input.workflow_settings;
  if (input.scoring_config !== undefined) patch.scoring_config = input.scoring_config;
  if (input.ai_config !== undefined) patch.ai_config = input.ai_config;
  if (input.evidence_config !== undefined) patch.evidence_config = input.evidence_config;
  if (input.calculated_fields !== undefined) patch.calculated_fields = input.calculated_fields;
  if (input.operating_model !== undefined) patch.operating_model = input.operating_model;
  if (input.audit_purpose !== undefined) patch.audit_purpose = input.audit_purpose;
  if (input.subject_type !== undefined) patch.subject_type = input.subject_type;
  if (input.hierarchy_profile_id !== undefined) patch.hierarchy_profile_id = input.hierarchy_profile_id;
  if (input.hierarchy_bindings !== undefined) patch.hierarchy_bindings = input.hierarchy_bindings;
  if (input.is_system_template !== undefined) patch.is_system_template = input.is_system_template;
  if (input.purpose_config !== undefined) patch.purpose_config = input.purpose_config;
  if (input.short_description !== undefined) patch.short_description = input.short_description?.trim() || null;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.owner_user_id !== undefined) patch.owner_user_id = input.owner_user_id;

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
    short_description: source.short_description ?? undefined,
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
    operating_model: source.operating_model ?? undefined,
    audit_purpose: source.audit_purpose ?? undefined,
    subject_type: source.subject_type ?? undefined,
    hierarchy_profile_id: source.hierarchy_profile_id ?? undefined,
    hierarchy_bindings: source.hierarchy_bindings,
    purpose_config: source.purpose_config,
    is_system_template: false,
    visibility: "private",
  });
}

export async function shareAuditTemplateWithOrganization(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.rpc("share_audit_template_with_org", {
    p_template_id: id,
  });
  if (error) {
    const template = await fetchAuditTemplate(id);
    if (!template) throw new Error("Template not found.");
    if (template.owner_user_id !== userId) {
      throw new Error("Only the template owner can share this template.");
    }
    await updateAuditTemplate(id, { visibility: "organization" });
    return;
  }
}

export async function fetchTemplateUsageCounts(
  templateIds: string[],
): Promise<Record<string, number>> {
  if (!templateIds.length) return {};
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("scan_assignments")
    .select("template_id")
    .eq("org_id", orgId)
    .in("template_id", templateIds);
  if (error) {
    if (error.code === "42P01") return {};
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.template_id as string;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
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
