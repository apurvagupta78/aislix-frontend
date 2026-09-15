import type {
  AuditLevel,
  AuditPurpose,
  AuditSubjectType,
  FieldType,
  OperatingModel,
  TemplateDefinition,
  TemplateField,
  TemplateRule,
  TemplateSection,
} from "@/lib/audit-builder/types";
import {
  STANDARD_FINDING_TYPES,
  UNIVERSAL_RCA_OPTIONS,
} from "@/lib/audit-engine/operating-model-catalog";

let fieldCounter = 0;

export function resetFieldCounter() {
  fieldCounter = 0;
}

function fid(): string {
  fieldCounter += 1;
  return `f_${fieldCounter}`;
}

export function field(
  section: string,
  order: number,
  type: FieldType,
  label: string,
  opts: Partial<TemplateField> = {},
): TemplateField {
  const { key, required, config, standardConcept, category, calculated, quantityLinked, ...rest } =
    opts;
  return {
    id: fid(),
    key: key ?? label.toLowerCase().replace(/\s+/g, "_"),
    type,
    label,
    section,
    order,
    required: required ?? false,
    config: config ?? {},
    standardConcept,
    category,
    calculated,
    quantityLinked,
    ...rest,
  };
}

export function sec(key: string, title: string, order: number, extra?: Partial<TemplateSection>): TemplateSection {
  return { key, title, order, ...extra };
}

export function baseWorkflow(requireRca = true) {
  return {
    submission: "manager_approval" as const,
    autoFindingOnVariance: true,
    autoFindingOnFailedQc: true,
    autoFindingOnExpired: true,
    requireRcaOnVariance: requireRca,
    correctiveAction: "auto" as const,
    slaEnabled: true,
    slaBySeverity: { critical: 4, high: 12, medium: 24, low: 72 },
  };
}

export function baseEvidence(expiryUnitCoverage = false, minPhotos = 1) {
  return {
    photoRequired: true,
    minPhotos,
    gps: true,
    timestamp: true,
    preventDuplicates: true,
    expiryUnitCoverage,
  };
}

export function baseAi(opts: { expiryOcr?: boolean; planogram?: boolean; skuDetect?: boolean } = {}) {
  const { expiryOcr, planogram, skuDetect } = opts;
  const enabled = Boolean(expiryOcr || planogram || skuDetect);
  return {
    enabled,
    features: {
      ...(expiryOcr
        ? {
            expiry_ocr: { enabled: true, mode: "assist" as const, confidenceThreshold: 0.7 },
            duplicate_evidence: { enabled: true, mode: "assist" as const },
          }
        : {}),
      ...(planogram
        ? { planogram_detection: { enabled: true, mode: "assist" as const, confidenceThreshold: 0.75 } }
        : {}),
      ...(skuDetect
        ? { sku_detection: { enabled: true, mode: "assist" as const, confidenceThreshold: 0.7 } }
        : {}),
    },
  };
}

export function varianceRules(): TemplateRule[] {
  return [
    {
      id: "rule-variance-rca",
      label: "Variance requires RCA",
      when: { field: "actual_qty", operator: "neq", value: { ref: "expected_qty" } },
      then: [
        { action: "require_field", field: "rca" },
        { action: "create_finding", findingType: "Inventory Variance", severity: "medium" },
      ],
    },
  ];
}

export function expiryRules(thresholdDays = 30): TemplateRule[] {
  return [
    {
      id: "rule-expired",
      label: "Expired product finding",
      when: { field: "expiry_date", operator: "before_today" },
      then: [{ action: "create_finding", findingType: "Expired Product", severity: "critical" }],
    },
    {
      id: "rule-near-expiry",
      label: "Near expiry finding",
      when: { field: "expiry_date", operator: "within_days", value: thresholdDays },
      then: [{ action: "create_finding", findingType: "Near Expiry", severity: "high" }],
    },
    {
      id: "rule-expiry-coverage",
      label: "Expiry coverage required",
      when: { field: "physical_qty", operator: "gt", value: 0 },
      then: [{ action: "require_field", field: "expiry_coverage" }],
    },
  ];
}

export function qcFailRules(): TemplateRule[] {
  return [
    {
      id: "rule-qc-fail",
      label: "QC fail requires evidence and RCA",
      when: { field: "qc_status", operator: "eq", value: "Fail" },
      then: [
        { action: "require_field", field: "defect_type" },
        { action: "require_field", field: "defect_severity" },
        { action: "require_field", field: "rca" },
        { action: "min_images", field: "images", value: 1 },
        { action: "create_finding", findingType: "QC Failure", severity: "high" },
      ],
    },
  ];
}

export function planogramFailRules(): TemplateRule[] {
  return [
    {
      id: "rule-planogram-violation",
      label: "Planogram violation",
      when: { field: "compliance", operator: "eq", value: "Fail" },
      then: [{ action: "create_finding", findingType: "Planogram Violation", severity: "high" }],
    },
  ];
}

export type TemplateBuildConfig = {
  sections: TemplateSection[];
  fields: TemplateField[];
  rules?: TemplateRule[];
  workflow?: ReturnType<typeof baseWorkflow>;
  scoring?: TemplateDefinition["scoring"];
  ai?: TemplateDefinition["ai"];
  evidence?: TemplateDefinition["evidence"];
  calculatedFields?: TemplateDefinition["calculatedFields"];
  auditLevel: AuditLevel;
  operatingModel: OperatingModel;
  purpose: AuditPurpose;
  subjectType: AuditSubjectType;
};

export function assembleTemplate(config: TemplateBuildConfig): TemplateDefinition {
  return {
    sections: config.sections,
    fields: config.fields,
    rules: config.rules ?? [],
    workflow: config.workflow ?? baseWorkflow(),
    scoring: config.scoring ?? { enabled: false },
    ai: config.ai ?? baseAi(),
    evidence: config.evidence ?? baseEvidence(),
    calculatedFields: config.calculatedFields ?? [],
    auditLevel: config.auditLevel,
    operatingModel: config.operatingModel,
    purpose: config.purpose,
    subjectType: config.subjectType,
    findingTypes: [...STANDARD_FINDING_TYPES],
    rcaOptions: [...UNIVERSAL_RCA_OPTIONS],
  };
}
