import type { OperatingModel, AuditPurpose } from "@/lib/audit-builder/types";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import type { AuditMode, ScopeType, ScopeValues } from "@/lib/assignments";

export type AssignmentMode = "assign_now" | "schedule_once" | "recurring";

export type AssignmentState =
  | "draft"
  | "scheduled"
  | "published"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "overdue"
  | "cancelled"
  | "reaudit_required";

export type ScheduleStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "expired" | "cancelled";

export type DistributionStrategy =
  | "manual"
  | "equal"
  | "location_based"
  | "team_based"
  | "role_based";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "weekdays" | "custom";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate: string;
  startTime: string;
  endDate?: string;
  maxOccurrences?: number;
  timezone: string;
};

export type DueConfig = {
  dueDate?: string;
  dueTime?: string;
  dueOffsetHours?: number;
};

export type LocationScope = {
  storeIds: string[];
  hierarchyNodeIds?: string[];
  countries?: string[];
  cities?: string[];
  regions?: string[];
  /** Resolved store metadata for preview */
  stores?: Array<{
    id: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }>;
};

export type TeamScope = {
  assigneeIds: string[];
  teamLabel?: string;
  roleFilter?: string;
  /** Manual mapping storeId -> assigneeId */
  manualMapping?: Record<string, string>;
};

export type DistributionEntry = {
  assigneeId: string;
  assigneeName: string;
  storeIds: string[];
  storeCount: number;
};

export type AssignmentPlan = {
  mode: AssignmentMode;
  operatingModel: OperatingModel;
  purpose: AuditPurpose;
  templateId?: string | null;
  templateVersion?: number | null;
  templateSnapshot?: Record<string, unknown> | null;
  templateName?: string;
  auditMode: AuditMode;
  scopeType: ScopeType;
  scopeValues: ScopeValues;
  locationScope: LocationScope;
  teamScope: TeamScope;
  distributionStrategy: DistributionStrategy;
  distribution: DistributionEntry[];
  recurrence?: RecurrenceRule;
  dueConfig: DueConfig;
  publishAt?: string | null;
  evidencePolicy?: AuditEvidencePolicy | null;
  requireRca: boolean;
  reviewerId?: string | null;
  instructions?: string | null;
  campaignName?: string | null;
  planogramVersionId?: string | null;
  inputSource?: string;
  creationSource?: string;
};

export type ConflictSeverity = "warning" | "blocking";

export type AssignmentConflict = {
  id: string;
  severity: ConflictSeverity;
  type:
    | "employee_overlap"
    | "location_overlap"
    | "capacity_exceeded"
    | "duplicate_schedule"
    | "recurrence_overlap";
  message: string;
  assigneeId?: string;
  assigneeName?: string;
  storeId?: string;
  storeName?: string;
};

export type AssignmentPreview = {
  templateName: string;
  mode: AssignmentMode;
  scheduleLabel: string;
  locationCount: number;
  cities: string[];
  countries: string[];
  teamCount: number;
  expectedAssignments: number;
  distribution: DistributionEntry[];
  conflicts: AssignmentConflict[];
  dueLabel: string;
};

export type OrgAssignmentSettings = {
  maxDailyAssignmentsPerEmployee?: number | null;
  maxConcurrentAudits?: number | null;
  estimatedAuditDurationMinutes?: number | null;
  reminderHours: number[];
  blockOnConflict: boolean;
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai)" },
  { value: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { value: "Europe/London", label: "UK (Europe/London)" },
  { value: "America/New_York", label: "US Eastern (America/New_York)" },
  { value: "America/Los_Angeles", label: "US Pacific (America/Los_Angeles)" },
  { value: "UTC", label: "UTC" },
] as const;

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  assign_now: "Assign Now",
  schedule_once: "Schedule Once",
  recurring: "Recurring Audit",
};

export const DISTRIBUTION_LABELS: Record<DistributionStrategy, string> = {
  manual: "Manual Assignment",
  equal: "Equal Distribution",
  location_based: "Location-Based",
  team_based: "Team-Based",
  role_based: "Role-Based",
};
