/** Expiry Control domain types — mirrors Supabase schema. */

export type InspectionStatus =
  | "draft"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "verified"
  | "rework_required"
  | "incomplete"
  | "cancelled";

export type RemovalStatus =
  | "not_required"
  | "required"
  | "reported_removed"
  | "received_quarantine"
  | "removal_verified";

export type DispositionStatus =
  | "not_applicable"
  | "pending"
  | "return_initiated"
  | "disposal_initiated"
  | "disposition_verified";

export type ObservationClassification = "sellable" | "near_expiry" | "expired" | "unresolved";

export type DateType = "expiry" | "use_by" | "best_before" | "manufacturing" | "unknown";

export type AssuranceLevel = "standard" | "high";

export type ExpiryExceptionIssue =
  | "expired_not_quarantined"
  | "unresolved_not_held"
  | "rejected_evidence"
  | "quantity_mismatch"
  | "duplicate_evidence"
  | "overdue_inspection"
  | "near_expiry_action"
  | "receipt_mismatch"
  | "other";

export type ExpiryInspectionAttempt = {
  id: string;
  org_id: string;
  assignment_id: string;
  store_id: string;
  location_id: string | null;
  sku: string;
  product_name: string | null;
  inspection_status: InspectionStatus;
  removal_status: RemovalStatus;
  disposition_status: DispositionStatus;
  auditor_id: string;
  reviewer_id: string | null;
  assurance_level: AssuranceLevel;
  assurance_fallback: string | null;
  expected_quantity: number;
  actual_quantity: number | null;
  physical_count: number | null;
  sellable_count: number;
  remove_count: number;
  unresolved_count: number;
  observations_count: number;
  quantity_discrepancy_reason: string | null;
  unable_to_inspect_reason: string | null;
  location_coverage: Record<string, boolean>;
  store_fully_checked: boolean;
  coverage_statement: string | null;
  wizard_step: number;
  due_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpiryPacketObservation = {
  id: string;
  attempt_id: string;
  packet_ordinal: number;
  sku: string;
  raw_date_text: string | null;
  date_type: DateType | null;
  parsed_date: string | null;
  batch_lot: string | null;
  ai_suggested_date: string | null;
  ai_confidence: number | null;
  ai_simulated: boolean;
  human_confirmed_date: string | null;
  human_correction: string | null;
  classification: ObservationClassification;
  placement: string | null;
  duplicate_hash_flag: boolean;
  similarity_flag: boolean;
  unreadable: boolean;
  wrong_product: boolean;
  review_status: string;
};

export type ExpiryAssignment = {
  id: string;
  org_id: string;
  store_id: string;
  title: string;
  status: string;
  auditor_id: string;
  reviewer_id: string | null;
  due_at: string | null;
  assurance_level: AssuranceLevel;
  instructions: string | null;
  sku_filters: { sku?: string };
  created_at: string;
};

export type ExpiryException = {
  id: string;
  attempt_id: string | null;
  store_id: string | null;
  sku: string | null;
  issue_type: ExpiryExceptionIssue;
  severity: string;
  title: string;
  quantity: number;
  owner_id: string | null;
  status: string;
  due_at: string | null;
  sort_priority: number;
  created_at: string;
};

export type ExpiryOverviewMetrics = {
  units_in_scope: number;
  units_inspected: number;
  expired_detected: number;
  near_expiry: number;
  unresolved_dates: number;
  awaiting_removal_verification: number;
  in_quarantine: number;
  disposition_pending: number;
  overdue_inspections: number;
  open_exceptions: number;
  refreshed_at: string;
  /** Physical units requiring verification across open/recent attempts. */
  required_units?: number | null;
  /** Units with verified readable expiry + evidence. */
  verified_units?: number | null;
  /** verified/required × 100; null when required unknown. */
  evidence_coverage_pct?: number | null;
  /** Count of attempts marked EVIDENCE INCOMPLETE. */
  evidence_incomplete_count?: number;
};

export type ExpiryQuarantineTransfer = {
  id: string;
  attempt_id: string;
  removal_reason: string;
  sku: string;
  quantity: number;
  sender_id: string;
  receiver_id: string | null;
  transfer_status: string;
  transferred_at: string;
  container_code?: string;
  quarantine_location?: string;
};

export type ExpiryEvidenceAsset = {
  id: string;
  storage_path: string;
  file_hash: string;
  mime_type: string | null;
  capture_source: string;
  evidence_status: string;
  device_metadata: Record<string, unknown>;
  captured_at: string | null;
  signedUrl?: string;
};

export type ExpiryEvidenceLink = {
  id: string;
  evidence_id: string;
  attempt_id: string | null;
  observation_id: string | null;
  link_type: string;
  session_timestamp_ms: number | null;
};

export type ExpiryAttemptEvidence = {
  sessionVideo: ExpiryEvidenceAsset | null;
  packetPhotos: Array<{
    observationId: string | null;
    packetOrdinal: number | null;
    asset: ExpiryEvidenceAsset;
    sessionTimestampMs: number | null;
  }>;
  assuranceFallback: boolean;
};

export type ExpiryPolicyVersion = {
  id: string;
  name: string;
  version: number;
  status: string;
  near_expiry_days: number;
  rules: Record<string, unknown>;
  published_at: string | null;
};

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Draft",
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
  rework_required: "Rework required",
  incomplete: "EVIDENCE INCOMPLETE",
  cancelled: "Cancelled",
};

export const REMOVAL_STATUS_LABEL: Record<RemovalStatus, string> = {
  not_required: "Not required",
  required: "Required",
  reported_removed: "Reported removed",
  received_quarantine: "In quarantine",
  removal_verified: "Removal verified",
};

export const CLASSIFICATION_LABEL: Record<ObservationClassification, string> = {
  sellable: "Sellable",
  near_expiry: "Near expiry",
  expired: "Expired",
  unresolved: "Unresolved",
};
