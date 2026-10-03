import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import { isImageField } from "@/lib/audit-builder/field-library";
import { isFieldReadOnlyForAuditor, type InputSchema } from "@/lib/audit-builder/field-roles";
import { resolveFieldKey } from "@/lib/audit-builder/input-schema";
import type { AuditResponseValue, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import { numericCell } from "@/lib/new-audit/digital-columns";

export type CellKind = "text" | "number" | "date" | "select" | "rca" | "image" | "calculated" | "long_text";

export type ExecutionColumn = {
  key: string;
  label: string;
  field: TemplateField;
  kind: CellKind;
  editable: boolean;
  role: "provided" | "fill" | "calculated" | "evidence";
  required: boolean;
  options?: string[];
  /** Key of the provided column this column is verified against. */
  compareWithKey?: string;
};

export type RowEvidenceMode = "required" | "on_mismatch" | "optional" | "off";

export const ROW_EVIDENCE_OPTIONS: Array<{ value: RowEvidenceMode; label: string }> = [
  { value: "required", label: "Required" },
  { value: "on_mismatch", label: "Required on mismatches" },
  { value: "optional", label: "Optional" },
  { value: "off", label: "Off" },
];

export const EVIDENCE_PHOTO_KEY = "evidence_photo";
export const EVIDENCE_STATUS_KEY = "evidence_status";
export const EVIDENCE_FLAGS_KEY = "evidence_flags";

const NUMBER_TYPES = new Set([
  "number",
  "currency",
  "percentage",
  "temperature",
  "weight",
  "measurement",
  "custom_numeric",
  "quality_score",
]);

function cellKind(field: TemplateField): CellKind {
  if (field.calculated) return "calculated";
  if (isImageField(field.type)) return "image";
  if (field.type === "rca") return "rca";
  if (["qc_status", "dropdown", "radio", "yes_no", "checkbox"].includes(field.type)) return "select";
  if (["long_text", "notes", "remarks"].includes(field.type)) return "long_text";
  if (field.type.includes("date")) return "date";
  if (field.type.includes("qty") || NUMBER_TYPES.has(field.type)) return "number";
  return "text";
}

function selectOptions(field: TemplateField): string[] {
  if (field.config.options?.length) return field.config.options;
  if (field.type === "yes_no" || field.type === "checkbox") return ["Yes", "No"];
  return ["Pass", "Fail"];
}

export function repeatableSectionKey(definition: TemplateDefinition): string | null {
  return definition.sections.find((s) => s.repeatable)?.key ?? null;
}

/** Ordered table columns for the repeatable section of a template. */
export function buildExecutionColumns(
  definition: TemplateDefinition,
  inputSchema?: InputSchema | null,
): ExecutionColumn[] {
  const sectionKey = repeatableSectionKey(definition);
  if (!sectionKey) return [];

  const compareWith = new Map<string, string>();
  if (inputSchema?.columnMappings?.length) {
    const keyOf = new Map(inputSchema.columnMappings.map((m) => [m.columnId, resolveFieldKey(m, inputSchema)]));
    for (const m of inputSchema.columnMappings) {
      const target = m.compareWithColumnId ? keyOf.get(m.compareWithColumnId) : undefined;
      if (target) compareWith.set(keyOf.get(m.columnId)!, target);
    }
  }

  return definition.fields
    .filter((f) => f.section === sectionKey && !f.system && f.config.visible !== false)
    .sort((a, b) => a.order - b.order)
    .map((field) => {
      const kind = cellKind(field);
      const editable = kind !== "calculated" && !isFieldReadOnlyForAuditor(field);
      const role: ExecutionColumn["role"] =
        kind === "calculated" ? "calculated" : kind === "image" ? "evidence" : editable ? "fill" : "provided";
      const target = editable ? compareWith.get(field.key) : undefined;
      return {
        key: field.key,
        label: field.label,
        field,
        kind,
        editable,
        role,
        required: field.required,
        ...(kind === "select" ? { options: selectOptions(field) } : {}),
        ...(kind === "rca" ? { options: RCA_OPTIONS.map((o) => o.label) } : {}),
        ...(target ? { compareWithKey: target } : {}),
      };
    });
}

export function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : null;
  const text = String(value).trim();
  return text ? text : null;
}

export type PairStatus = "match" | "mismatch" | "not_filled";

/** Auditee value vs provided value: numeric difference when both are numbers, else a text match. */
export function verifyPair(provided: unknown, actual: unknown): { difference: number | null; status: PairStatus } {
  const actualText = cellText(actual);
  if (actualText === null) return { difference: null, status: "not_filled" };
  const actualNumber = numericCell(actualText);
  const providedNumber = numericCell(provided);
  if (actualNumber !== null && providedNumber !== null) {
    const difference = Math.round((actualNumber - providedNumber) * 100) / 100;
    return { difference, status: difference === 0 ? "match" : "mismatch" };
  }
  const squash = (text: string) => text.replace(/\s+/g, " ").toLowerCase();
  return {
    difference: null,
    status: squash(actualText) === squash(cellText(provided) ?? "") ? "match" : "mismatch",
  };
}

export type ExecutionRecord = { index: number; values: Record<string, AuditResponseValue | undefined> };

function csvValue(column: ExecutionColumn, value: unknown): string {
  if (column.kind === "rca") {
    const code = cellText(value);
    return RCA_OPTIONS.find((o) => o.code === code)?.label ?? code ?? "";
  }
  return cellText(value) ?? "";
}

/** Headers and rows for the auditee's offline copy. Photo columns are filled on screen only. */
export function buildFillCsv(
  columns: ExecutionColumn[],
  records: ExecutionRecord[],
): { headers: string[]; rows: string[][] } {
  const exported = columns.filter((c) => c.kind !== "image");
  return {
    headers: ["Row #", ...exported.map((c) => c.label)],
    rows: records.map((record, position) => [
      String(position + 1),
      ...exported.map((c) => csvValue(c, record.values[c.key])),
    ]),
  };
}

export type UploadIssue = { row: number; column: string; value: string; reason: string };
export type UploadUpdate = { recordIndex: number; fieldKey: string; value: AuditResponseValue };

export type UploadValidation = {
  updates: UploadUpdate[];
  newRecordIndexes: number[];
  issues: UploadIssue[];
  ignoredProvidedEdits: Array<{ row: number; column: string }>;
  unknownColumns: string[];
  missingColumns: string[];
  ignoredExtraRows: number[];
  skippedPhotoColumns: string[];
  matchedBy: "row_number" | "order";
};

function normalizeHeader(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isRowNumberHeader(name: string): boolean {
  const n = normalizeHeader(name);
  return name.trim() === "#" || n === "row" || n === "rowno" || n === "rownumber" || n === "sno" || n === "srno";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO date from YYYY-MM-DD or day-first D/M/YYYY (also D-M-YY); null when not a real date. */
export function parseDateCell(raw: string): string | null {
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dayFirst) {
    [d, m, y] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseCell(
  column: ExecutionColumn,
  raw: string,
): { value: AuditResponseValue } | { error: string } {
  const { config } = column.field;
  switch (column.kind) {
    case "number": {
      const n = numericCell(raw);
      if (n === null) return { error: `"${raw}" is not a number` };
      if (config.min !== undefined && n < config.min) return { error: `must be at least ${config.min}` };
      if (config.max !== undefined && n > config.max) return { error: `must be at most ${config.max}` };
      return { value: n };
    }
    case "date": {
      const iso = parseDateCell(raw);
      return iso ? { value: iso } : { error: `"${raw}" is not a valid date (use YYYY-MM-DD)` };
    }
    case "select": {
      const match = column.options?.find((o) => o.toLowerCase() === raw.toLowerCase());
      return match ? { value: match } : { error: `"${raw}" is not one of: ${column.options?.join(", ")}` };
    }
    case "rca": {
      const match = RCA_OPTIONS.find(
        (o) => o.code.toLowerCase() === raw.toLowerCase() || o.label.toLowerCase() === raw.toLowerCase(),
      );
      return match ? { value: match.code } : { error: `"${raw}" is not a known reason` };
    }
    default:
      if (config.maxLength !== undefined && raw.length > config.maxLength) {
        return { error: `must be at most ${config.maxLength} characters` };
      }
      return { value: raw };
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  const left = cellText(a);
  const right = cellText(b);
  if (left === right) return true;
  if (left === null || right === null) return false;
  const ln = numericCell(left);
  const rn = numericCell(right);
  if (ln !== null && rn !== null) return ln === rn;
  const squash = (text: string) => text.replace(/\s+/g, " ").toLowerCase();
  return squash(left) === squash(right);
}

/**
 * A text column paired with a provided column whose values are all numbers is checked as a number,
 * so "abc" against an Amount is rejected even when the column was created as text.
 */
export function withNumericPairs(columns: ExecutionColumn[], records: ExecutionRecord[]): ExecutionColumn[] {
  return columns.map((column) => {
    if (column.kind !== "text" || !column.compareWithKey) return column;
    const provided = records.map((r) => cellText(r.values[column.compareWithKey!])).filter((v): v is string => v !== null);
    return provided.length && provided.every((v) => numericCell(v) !== null) ? { ...column, kind: "number" } : column;
  });
}

/**
 * Check an auditee's filled copy against the audit. Only editable cells are imported;
 * provided values always stay as uploaded by the manager.
 */
export function validateFilledUpload(
  upload: AuditInputDataset,
  columns: ExecutionColumn[],
  records: ExecutionRecord[],
  opts: { hasProvidedData: boolean },
): UploadValidation {
  const byHeader = new Map<string, ExecutionColumn>();
  for (const c of columns) {
    byHeader.set(normalizeHeader(c.label), c);
    if (!byHeader.has(normalizeHeader(c.key))) byHeader.set(normalizeHeader(c.key), c);
  }

  const rowNumberColumn = upload.columns.find((c) => isRowNumberHeader(c.name));
  const mapped: Array<{ uploadId: string; column: ExecutionColumn }> = [];
  const unknownColumns: string[] = [];
  const skippedPhotoColumns: string[] = [];
  const seen = new Set<string>();
  for (const uc of upload.columns) {
    if (uc === rowNumberColumn) continue;
    const column = byHeader.get(normalizeHeader(uc.name));
    if (!column || seen.has(column.key)) {
      unknownColumns.push(uc.name);
      continue;
    }
    seen.add(column.key);
    if (column.kind === "image") {
      skippedPhotoColumns.push(column.label);
      continue;
    }
    mapped.push({ uploadId: uc.id, column });
  }
  const missingColumns = columns
    .filter((c) => c.editable && c.kind !== "image" && !seen.has(c.key))
    .map((c) => c.label);

  const result: UploadValidation = {
    updates: [],
    newRecordIndexes: [],
    issues: [],
    ignoredProvidedEdits: [],
    unknownColumns,
    missingColumns,
    ignoredExtraRows: [],
    skippedPhotoColumns,
    matchedBy: rowNumberColumn ? "row_number" : "order",
  };

  let nextIndex = Math.max(-1, ...records.map((r) => r.index)) + 1;
  const newIndexByPosition = new Map<number, number>();
  const usedPositions = new Set<number>();

  upload.rows.forEach((row, uploadIndex) => {
    let position = uploadIndex;
    if (rowNumberColumn) {
      const raw = (row.values[rowNumberColumn.id] ?? "").trim();
      const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!Number.isInteger(n) || n < 1) {
        result.issues.push({ row: uploadIndex + 1, column: rowNumberColumn.name, value: raw, reason: "Row number is missing or invalid" });
        return;
      }
      position = n - 1;
    }
    const rowNo = position + 1;
    if (usedPositions.has(position)) {
      result.issues.push({ row: rowNo, column: rowNumberColumn?.name ?? "Row #", value: String(rowNo), reason: "Row appears twice in the file" });
      return;
    }
    usedPositions.add(position);

    let record = records[position];
    if (!record) {
      if (opts.hasProvidedData) {
        result.ignoredExtraRows.push(rowNo);
        return;
      }
      const index = newIndexByPosition.get(position) ?? nextIndex++;
      newIndexByPosition.set(position, index);
      result.newRecordIndexes.push(index);
      record = { index, values: {} };
    }

    for (const { uploadId, column } of mapped) {
      const raw = (row.values[uploadId] ?? "").trim().replace(/^'/, "");
      const current = record.values[column.key];
      if (!column.editable) {
        if (column.kind !== "calculated" && raw && !sameValue(raw, current)) {
          result.ignoredProvidedEdits.push({ row: rowNo, column: column.label });
        }
        continue;
      }
      if (!raw) {
        if (column.required && cellText(current) === null) {
          result.issues.push({ row: rowNo, column: column.label, value: "", reason: "Required value is empty" });
        }
        continue;
      }
      const parsed = parseCell(column, raw);
      if ("error" in parsed) {
        result.issues.push({ row: rowNo, column: column.label, value: raw, reason: parsed.error });
        continue;
      }
      if (sameValue(parsed.value, current)) continue;
      result.updates.push({ recordIndex: record.index, fieldKey: column.key, value: parsed.value });
    }
  });

  return result;
}

export type EvidenceStatus = "verified" | "needs_review" | "missing" | "not_required";

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  verified: "Verified",
  needs_review: "Needs review",
  missing: "Missing evidence",
  not_required: "Not required",
};

/** Per-row photo check done in the app: presence, minimum count, and quality / duplicate flags. */
export function evidenceCheck(input: {
  mode: RowEvidenceMode;
  photos: string[];
  minimumPhotos: number;
  flags: string[];
  hasMismatch: boolean;
}): { status: EvidenceStatus; reasons: string[] } {
  if (input.mode === "off") return { status: "not_required", reasons: [] };
  const needed = input.mode === "required" || (input.mode === "on_mismatch" && input.hasMismatch);
  if (!input.photos.length) {
    return needed
      ? { status: "missing", reasons: [input.mode === "on_mismatch" ? "Photo needed for this mismatch" : "No photo yet"] }
      : { status: "not_required", reasons: [] };
  }
  const reasons = [...new Set(input.flags)];
  if (input.photos.length < input.minimumPhotos) {
    reasons.push(`${input.photos.length} of ${input.minimumPhotos} photos`);
  }
  return { status: reasons.length ? "needs_review" : "verified", reasons };
}

const FLAG_SEPARATOR = "::";

export function encodeEvidenceFlag(url: string, reason: string): string {
  return `${url}${FLAG_SEPARATOR}${reason}`;
}

/** Reasons recorded for photos that are still attached to the row. */
export function activeEvidenceFlags(flags: unknown, photos: string[]): string[] {
  if (!Array.isArray(flags)) return [];
  const present = new Set(photos);
  return flags.flatMap((entry) => {
    const text = String(entry);
    const at = text.lastIndexOf(FLAG_SEPARATOR);
    if (at < 0) return [];
    return present.has(text.slice(0, at)) ? [text.slice(at + FLAG_SEPARATOR.length)] : [];
  });
}

export function photoList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return typeof value === "string" && value.trim() ? [value] : [];
}

export type RowEvidenceConfig = {
  mode: RowEvidenceMode;
  field: TemplateField | null;
  minimumPhotos: number;
  qualityChecks: AuditEvidencePolicy["qualityChecks"];
};

/**
 * Row photo rules: the manager's per-row setting on Digital Audit uploads, otherwise derived
 * from the first photo field and the assignment's evidence policy.
 */
export function resolveRowEvidence(input: {
  definition: TemplateDefinition;
  purposeConfig: Record<string, unknown> | null | undefined;
  evidencePolicy: Partial<AuditEvidencePolicy> | null | undefined;
}): RowEvidenceConfig {
  const sectionKey = repeatableSectionKey(input.definition);
  const field =
    input.definition.fields.find(
      (f) => f.section === sectionKey && isImageField(f.type) && !f.system && f.config.visible !== false,
    ) ?? null;
  const policy = input.evidencePolicy ?? {};
  const qualityChecks = policy.qualityChecks ?? ["duplicate_hash"];
  const minimumPhotos = Math.max(1, policy.minimumPhotos ?? 1, field?.config.minImages ?? 0);
  if (!field) return { mode: "off", field: null, minimumPhotos, qualityChecks };

  const explicit = input.purposeConfig?.rowEvidence;
  let mode: RowEvidenceMode;
  if (explicit === "required" || explicit === "on_mismatch" || explicit === "optional" || explicit === "off") {
    mode = explicit;
  } else if (field.required || policy.requiredProof?.includes("per_sku_photo")) {
    mode = "required";
  } else if (policy.requiredProof?.includes("variance_photo")) {
    mode = "on_mismatch";
  } else {
    mode = "optional";
  }
  return { mode, field, minimumPhotos, qualityChecks };
}

export function auditDisplayId(assignmentId: string): string {
  return `AUD-${assignmentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function durationLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}

export function timeLeft(dueAt: string | null, now: number): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  const diff = due - now;
  return diff >= 0
    ? { label: `${durationLabel(diff)} left`, overdue: false }
    : { label: `Overdue by ${durationLabel(-diff)}`, overdue: true };
}
