/**
 * Custom Audit Builder — core type definitions.
 */

export type TemplateStatus = "draft" | "published" | "archived";

export type OperatingModel =
  | "local_store"
  | "supermarket"
  | "dark_store"
  | "warehouse"
  | "fmcg_distributor"
  | "custom";

export type AuditMethod = "digital" | "ai" | "ai_assisted";

export type AuditPurpose =
  | "outlet_visit"
  | "distributor"
  | "stock"
  | "inventory"
  | "availability"
  | "oos"
  | "retail_execution"
  | "merchandising"
  | "shelf"
  | "planogram"
  | "pricing"
  | "promotion"
  | "posm"
  | "visibility"
  | "expiry"
  | "fnv_qc"
  | "competitor"
  | "new_product_launch"
  | "order_distribution"
  | "scheme_compliance"
  | "outlet_compliance"
  | "receiving"
  | "putaway"
  | "picking"
  | "dispatch"
  | "custom";

export type AuditSubjectType =
  | "audit"
  | "store"
  | "outlet"
  | "distributor"
  | "warehouse"
  | "sku"
  | "product"
  | "batch"
  | "shelf"
  | "rack"
  | "bin"
  | "shipment"
  | "purchase_order"
  | "order"
  | "unit"
  | "custom";

export type FieldCategoryId =
  | "organization_hierarchy"
  | "audit_metadata"
  | "people"
  | "location"
  | "outlet"
  | "product_sku"
  | "brand"
  | "inventory"
  | "sales"
  | "availability"
  | "shelf_merchandising"
  | "planogram"
  | "pricing"
  | "promotion"
  | "posm_visibility"
  | "expiry_batch"
  | "quality_fnv"
  | "warehouse"
  | "receiving"
  | "picking_dispatch"
  | "evidence"
  | "identification"
  | "investigation"
  | "corrective_action"
  | "scoring"
  | "calculated"
  | "system"
  | "ai";

export type MasterDataSource =
  | "organization"
  | "hierarchy"
  | "employee"
  | "store"
  | "outlet"
  | "distributor"
  | "warehouse"
  | "product"
  | "brand"
  | "category"
  | "promotion"
  | "custom";

export type StandardFieldConcept =
  | "expected_quantity"
  | "actual_quantity"
  | "physical_quantity"
  | "variance_units"
  | "variance_percent"
  | "mrp"
  | "potential_value_variance"
  | "expiry_date"
  | "days_remaining"
  | "expiry_status"
  | "sku_id"
  | "product_name"
  | "availability"
  | "oos"
  | "expected_facing"
  | "actual_facing"
  | "facing_variance"
  | "planogram_compliance"
  | "price_compliance"
  | "promotion_compliance"
  | "posm_compliance"
  | "qc_status"
  | "finding_type"
  | "rca"
  | "evidence"
  | "gps"
  | "audit_status"
  | "sales_value"
  | "sales_target"
  | "target_achievement"
  | "growth_percent"
  | "custom";

export type HierarchyLevelConfig = {
  key: string;
  label: string;
  order: number;
  required?: boolean;
  masterDataSource?: MasterDataSource;
};

export type AuditHierarchyConfig = {
  definitionId?: string | null;
  levels: HierarchyLevelConfig[];
};

export type AuditLevel =
  | "one_per_audit"
  | "one_per_sku"
  | "one_per_shelf"
  | "one_per_location"
  | "repeating_section";

export type BuilderTemplateType =
  | "shelf_audit"
  | "inventory_audit"
  | "fnv_qc_audit"
  | "expiry_audit"
  | "store_visit_audit"
  | "warehouse_audit"
  | "distributor_audit"
  | "planogram_audit"
  | "promotion_audit"
  | "custom";

export type FieldType =
  | "sku_id"
  | "item_code"
  | "item_name"
  | "brand"
  | "category"
  | "subcategory"
  | "variant"
  | "batch_number"
  | "lot_number"
  | "expected_qty"
  | "actual_qty"
  | "qty_variance"
  | "qty_variance_pct"
  | "damaged_qty"
  | "expired_qty"
  | "audit_date"
  | "mfg_date"
  | "expiry_date"
  | "best_before_date"
  | "expiry_days_remaining"
  | "qc_status"
  | "pass_fail"
  | "quality_score"
  | "defect_type"
  | "defect_severity"
  | "severity"
  | "temperature"
  | "weight"
  | "measurement"
  | "custom_numeric"
  | "single_image"
  | "multiple_images"
  | "video"
  | "document"
  | "before_after_images"
  | "barcode_scanner"
  | "qr_scanner"
  | "sku_selector"
  | "batch_selector"
  | "gps"
  | "store"
  | "warehouse"
  | "shelf"
  | "rack"
  | "bin"
  | "short_text"
  | "long_text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "dropdown"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "rca"
  | "finding_type"
  | "corrective_action"
  | "notes"
  | "auditor"
  | "manager"
  | "audit_id"
  | "timestamp"
  | "audit_source";

export type FieldConfig = {
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minDate?: string;
  maxDate?: string;
  decimalAllowed?: boolean;
  unit?: string;
  options?: string[];
  allowCustomOption?: boolean;
  defaultOption?: string;
  minImages?: number;
  maxImages?: number;
  cameraRequired?: boolean;
  galleryAllowed?: boolean;
  gpsRequired?: boolean;
  timestampRequired?: boolean;
  aiAnalysisEnabled?: boolean;
  imageQualityRequirement?: "standard" | "high";
  requireGps?: boolean;
  pattern?: string;
  duplicateDetection?: boolean;
  imageQualityCheck?: boolean;
  visible?: boolean;
  readOnly?: boolean;
  masterDataSource?: MasterDataSource;
  searchable?: boolean;
  filterable?: boolean;
  reportInclusion?: boolean;
  sensitivity?: "standard" | "business_sensitive";
  standardConcept?: StandardFieldConcept | string;
  aiFeature?: string;
  requireHumanConfirmation?: boolean;
};

export type AuditResponseValue = string | number | boolean | string[] | null;
export type FieldValues = Record<string, AuditResponseValue>;

export type VisibilityRule = {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
};

export type TemplateField = {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  section: string;
  order: number;
  required: boolean;
  config: FieldConfig;
  system?: boolean;
  calculated?: boolean;
  formula?: string;
  visibleWhen?: VisibilityRule;
  quantityLinked?: boolean;
  category?: FieldCategoryId;
  standardConcept?: StandardFieldConcept | string;
  masterDataSource?: MasterDataSource;
  searchable?: boolean;
  filterable?: boolean;
  reportInclusion?: boolean;
};

export type RepeatBy =
  | "audit"
  | "store"
  | "outlet"
  | "distributor"
  | "warehouse"
  | "sku"
  | "product"
  | "batch"
  | "shelf"
  | "rack"
  | "bin"
  | "shipment"
  | "purchase_order"
  | "order"
  | "unit"
  | "location"
  | "custom";

export type TemplateSection = {
  key: string;
  title: string;
  order: number;
  repeatable?: boolean;
  repeatBy?: RepeatBy;
  description?: string;
};

export type RuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before_today"
  | "within_days"
  | "is_empty"
  | "is_not_empty";

export type RuleCondition = {
  field: string;
  operator: RuleOperator;
  value?: unknown;
};

export type RuleAction =
  | { action: "require_field"; field: string }
  | { action: "hide_field"; field: string }
  | { action: "show_field"; field: string }
  | { action: "min_images"; field: string; value: number }
  | { action: "create_finding"; findingType: string; severity: string };

export type TemplateRule = {
  id: string;
  label: string;
  when: RuleCondition;
  then: RuleAction[];
};

export type WorkflowSettings = {
  submission?: "direct" | "manager_approval" | "regional_approval";
  autoFindingOnVariance?: boolean;
  autoFindingOnFailedQc?: boolean;
  autoFindingOnExpired?: boolean;
  correctiveAction?: "auto" | "manual";
  slaEnabled?: boolean;
  slaHours?: number;
  slaBySeverity?: Partial<Record<"critical" | "high" | "medium" | "low", number>>;
  requireRcaOnVariance?: boolean;
  requireResolutionVerification?: boolean;
  allowIncompleteEscalation?: boolean;
};

export type ScoringBand = { min: number; label: string };
export type ScoringWeight = { field: string; weight: number };

export type ScoringConfig = {
  enabled?: boolean;
  maxScore?: number;
  passingScore?: number;
  criticalFailureRule?: string;
  bands?: ScoringBand[];
  weights?: ScoringWeight[];
};

export type AiFeatureMode = "disabled" | "optional" | "required";

export type AiFeatureConfig = {
  enabled: boolean;
  mode: AiFeatureMode;
  confidenceThreshold?: number;
};

export type AiConfig = {
  enabled?: boolean;
  features?: Record<string, AiFeatureConfig>;
};

export type EvidenceConfig = {
  photoRequired?: boolean;
  minPhotos?: number;
  maxPhotos?: number;
  video?: boolean;
  gps?: boolean;
  timestamp?: boolean;
  barcode?: boolean;
  aiVerification?: boolean;
  expiryUnitCoverage?: boolean;
  beforeAfter?: boolean;
  preventDuplicates?: boolean;
};

export type CalculatedFieldDef = {
  key: string;
  label: string;
  formula: string;
};

export type TemplateDefinition = {
  sections: TemplateSection[];
  fields: TemplateField[];
  rules: TemplateRule[];
  workflow: WorkflowSettings;
  scoring: ScoringConfig;
  ai: AiConfig;
  evidence: EvidenceConfig;
  calculatedFields: CalculatedFieldDef[];
  auditLevel: AuditLevel;
  operatingModel?: OperatingModel;
  purpose?: AuditPurpose;
  method?: AuditMethod;
  subjectType?: AuditSubjectType;
  hierarchy?: AuditHierarchyConfig;
  channels?: string[];
  outletTypes?: string[];
  findingTypes?: string[];
  rcaOptions?: string[];
};

export type TemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_summary: string | null;
  created_at: string;
  created_by: string | null;
};

export type AuditResponseValue = string | number | boolean | string[] | null;

export type AuditResponse = {
  id: string;
  assignment_id: string;
  scan_id: string | null;
  template_id: string;
  template_version: number;
  section_key: string;
  record_index: number;
  field_key: string;
  field_type: FieldType;
  field_config: FieldConfig;
  value: AuditResponseValue;
  ai_suggested: unknown;
  human_confirmed: boolean;
};

export type CompletionItem = {
  sectionKey: string;
  recordIndex: number;
  fieldKey: string;
  label: string;
};

export type CompletionResult = {
  percent: number;
  complete: boolean;
  missing: CompletionItem[];
};
