/**
 * One completion model for a spreadsheet (digital) audit: the progress %, the
 * "rows complete" count and the "before you can submit" list are all derived
 * from the same required items, so they can never disagree with what blocks submit.
 */

import type { CompletionItem, CompletionResult, TemplateDefinition } from "@/lib/audit-builder/types";
import type { GridRequirement, GridRequirementId } from "./grid-evidence";

export type ReadinessRow = {
  index: number;
  position: number;
  photoNeeded: boolean;
  photoMissing: boolean;
  photoNeedsReview: boolean;
  reasonNeeded: boolean;
  reasonMissing: boolean;
  barcodeNeeded: boolean;
  barcodeMissing: boolean;
};

export type SubmitBlockerKind = "cells" | "header" | "photos" | "explanations" | "barcodes" | "evidence";

export type SubmitBlocker = {
  id: string;
  kind: SubmitBlockerKind;
  title: string;
  detail: string;
  /** Record indexes of the rows involved, so the UI can jump to the first one. */
  rowIndexes: number[];
};

export type SubmitReadiness = {
  percent: number;
  done: number;
  total: number;
  remaining: { cells: number; photos: number; explanations: number; barcodes: number; evidence: number };
  rowsComplete: number;
  rowsTotal: number;
  incompleteRows: Set<number>;
  blockers: SubmitBlocker[];
  /** Rows whose photo is flagged for review — does not block submit. */
  reviewRowPositions: number[];
  ready: boolean;
};

/** Requirements already counted per row, or recorded automatically. */
const ROW_LEVEL_REQUIREMENTS = new Set<GridRequirementId>([
  "per_sku_photo",
  "variance_photo",
  "barcode",
  "variance_explanation",
  "device_metadata",
]);

/** "ACTUAL AMOUNT" → "Actual amount"; mixed-case labels are kept as written. */
export function friendlyLabel(label: string): string {
  const trimmed = label.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return "this field";
  if (/[a-z]/.test(trimmed) || !/[A-Z]/.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** 1-based row numbers → "row 4" / "rows 22–26" / "rows 3, 5, 9–12 and 4 more". */
export function formatRows(numbers: number[], maxGroups = 6): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (!sorted.length) return "";
  const ranges: [number, number][] = [];
  for (const n of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  const text = ([a, b]: [number, number]) => (a === b ? String(a) : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
  const prefix = sorted.length === 1 ? "row" : "rows";
  if (ranges.length <= maxGroups) return `${prefix} ${ranges.map(text).join(", ")}`;
  const shown = ranges.slice(0, maxGroups);
  const shownCount = shown.reduce((sum, [a, b]) => sum + b - a + 1, 0);
  return `${prefix} ${shown.map(text).join(", ")} and ${sorted.length - shownCount} more`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

type CellGroup = { fieldKey: string; label: string; numbers: number[]; indexes: number[] };

/** Group missing required cells by field, using the row numbers the auditor sees. */
export function groupMissingCells(
  definition: TemplateDefinition,
  missing: CompletionItem[],
  repeatableSectionKey: string | null,
  positionOf: (recordIndex: number) => number,
): { rows: CellGroup[]; header: CellGroup[] } {
  const labelOf = new Map(definition.fields.map((f) => [`${f.section}:${f.key}`, f.label]));
  const rows = new Map<string, CellGroup>();
  const header = new Map<string, CellGroup>();
  for (const item of missing) {
    const repeatable = item.sectionKey === repeatableSectionKey;
    const bucket = repeatable ? rows : header;
    const id = `${item.sectionKey}:${item.fieldKey}`;
    const label = friendlyLabel(labelOf.get(id) ?? item.fieldKey);
    const group = bucket.get(id) ?? { fieldKey: item.fieldKey, label, numbers: [], indexes: [] };
    group.numbers.push(positionOf(item.recordIndex) + 1);
    group.indexes.push(item.recordIndex);
    bucket.set(id, group);
  }
  return { rows: [...rows.values()], header: [...header.values()] };
}

/** Plain-English sentences for missing required cells (used when the server rejects a submit). */
export function describeMissingCells(
  definition: TemplateDefinition,
  missing: CompletionItem[],
  records: { sectionKey: string; recordIndex: number }[],
): string[] {
  const repeatable = definition.sections.find((s) => s.repeatable)?.key ?? null;
  const order = records
    .filter((r) => r.sectionKey === repeatable)
    .map((r) => r.recordIndex)
    .sort((a, b) => a - b);
  const positionOf = (index: number) => {
    const at = order.indexOf(index);
    return at >= 0 ? at : index;
  };
  const groups = groupMissingCells(definition, missing, repeatable, positionOf);
  return [
    ...groups.header.map((g) => `“${g.label}” at the top of the audit is empty.`),
    ...groups.rows.map((g) => {
      const where = formatRows(g.numbers);
      return `“${g.label}” is empty on ${where}.`;
    }),
  ];
}

export function computeSubmitReadiness(input: {
  definition: TemplateDefinition;
  sectionKey: string;
  completion: CompletionResult;
  rows: ReadinessRow[];
  requirements: GridRequirement[];
  photoRule: "every_row" | "on_difference" | "none";
  /**
   * Required row-photo field already counted as "photos" — excluded from cells so
   * one empty photo is not counted twice.
   */
  requiredPhotoFieldKey?: string | null;
}): SubmitReadiness {
  const { definition, sectionKey, completion, rows, requirements } = input;
  const positionByIndex = new Map(rows.map((r) => [r.index, r.position]));
  const positionOf = (index: number) => positionByIndex.get(index) ?? index;
  const photoKey = input.requiredPhotoFieldKey ?? null;
  const missingCells = completion.missing.filter(
    (m) => !(photoKey && m.sectionKey === sectionKey && m.fieldKey === photoKey),
  );
  const cellGroups = groupMissingCells(definition, missingCells, sectionKey, positionOf);

  const photoCells = photoKey ? rows.length : 0;
  const photoCellsMissing = completion.missing.length - missingCells.length;
  const cellsTotal = Math.max(0, (completion.totalRequired ?? completion.missing.length) - photoCells);
  const cellsDone = Math.max(
    0,
    Math.min(
      cellsTotal - missingCells.length,
      (completion.filledRequired ?? cellsTotal - missingCells.length) - (photoCells - photoCellsMissing),
    ),
  );

  const photoRows = rows.filter((r) => r.photoNeeded || r.photoMissing);
  const photoMissing = photoRows.filter((r) => r.photoMissing);
  const reasonRows = rows.filter((r) => r.reasonNeeded || r.reasonMissing);
  const reasonMissing = reasonRows.filter((r) => r.reasonMissing);
  const barcodeRows = rows.filter((r) => r.barcodeNeeded || r.barcodeMissing);
  const barcodeMissing = barcodeRows.filter((r) => r.barcodeMissing);
  const auditLevel = requirements.filter((r) => !ROW_LEVEL_REQUIREMENTS.has(r.id) && r.total > 0);
  const evidenceTotal = auditLevel.reduce((sum, r) => sum + r.total, 0);
  const evidenceDone = auditLevel.reduce((sum, r) => sum + Math.min(r.done, r.total), 0);

  const total = cellsTotal + photoRows.length + reasonRows.length + barcodeRows.length + evidenceTotal;
  const done =
    cellsDone +
    (photoRows.length - photoMissing.length) +
    (reasonRows.length - reasonMissing.length) +
    (barcodeRows.length - barcodeMissing.length) +
    evidenceDone;

  const blockers: SubmitBlocker[] = [];
  for (const g of cellGroups.header) {
    blockers.push({
      id: `header:${g.fieldKey}`,
      kind: "header",
      title: `Fill in “${g.label}”`,
      detail: "This is in the audit details near the top of the page.",
      rowIndexes: [],
    });
  }
  for (const g of cellGroups.rows) {
    const n = g.numbers.length;
    blockers.push({
      id: `cells:${g.fieldKey}`,
      kind: "cells",
      title: `Enter “${g.label}”`,
      detail:
        n === 1
          ? `${capitalize(formatRows(g.numbers))} is still empty.`
          : `${n} rows are still empty: ${formatRows(g.numbers)}.`,
      rowIndexes: g.indexes,
    });
  }
  if (photoMissing.length) {
    const where = formatRows(photoMissing.map((r) => r.position + 1));
    blockers.push({
      id: "photos",
      kind: "photos",
      title: plural(photoMissing.length, "Add a photo", "Add photos"),
      detail:
        input.photoRule === "on_difference"
          ? `When your value is different from the provided one, that row needs a photo. Missing on ${where}.`
          : `Every row needs a photo in the Evidence column. Missing on ${where}.`,
      rowIndexes: photoMissing.map((r) => r.index),
    });
  }
  if (reasonMissing.length) {
    blockers.push({
      id: "explanations",
      kind: "explanations",
      title: plural(reasonMissing.length, "Explain the difference", "Explain the differences"),
      detail: `Choose a “Reason for difference” where your value is different from the provided one (“Other” also needs a note). Missing on ${formatRows(reasonMissing.map((r) => r.position + 1))}.`,
      rowIndexes: reasonMissing.map((r) => r.index),
    });
  }
  if (barcodeMissing.length) {
    blockers.push({
      id: "barcodes",
      kind: "barcodes",
      title: plural(barcodeMissing.length, "Scan the barcode", "Scan the barcodes"),
      detail: `Scan or type the barcode on ${formatRows(barcodeMissing.map((r) => r.position + 1))}.`,
      rowIndexes: barcodeMissing.map((r) => r.index),
    });
  }
  for (const req of auditLevel.filter((r) => !r.ok)) {
    const still = req.total > 1 && req.missing.length ? ` Still needed for: ${req.missing.join(", ")}.` : "";
    blockers.push({
      id: `evidence:${req.id}`,
      kind: "evidence",
      title: `Add the ${req.label.charAt(0).toLowerCase()}${req.label.slice(1)}`,
      detail: `${req.hint}${still}`,
      rowIndexes: [],
    });
  }

  const missingCellRows = new Set(missingCells.filter((m) => m.sectionKey === sectionKey).map((m) => m.recordIndex));
  const incompleteRows = new Set(
    rows
      .filter((r) => missingCellRows.has(r.index) || r.photoMissing || r.reasonMissing || r.barcodeMissing)
      .map((r) => r.index),
  );

  const ready = blockers.length === 0;
  const raw = total === 0 ? 100 : (done / total) * 100;
  const percent = ready ? 100 : Math.min(99, Math.floor(raw));

  return {
    percent,
    done,
    total,
    remaining: {
      cells: missingCells.length,
      photos: photoMissing.length,
      explanations: reasonMissing.length,
      barcodes: barcodeMissing.length,
      evidence: evidenceTotal - evidenceDone,
    },
    rowsComplete: rows.length - incompleteRows.size,
    rowsTotal: rows.length,
    incompleteRows,
    blockers,
    reviewRowPositions: rows.filter((r) => r.photoNeedsReview).map((r) => r.position + 1),
    ready,
  };
}

/** "5 cells, 2 photos and 1 explanation left" — or null when nothing is left. */
export function remainingSummary(remaining: SubmitReadiness["remaining"]): string | null {
  const parts = [
    remaining.cells ? `${remaining.cells} ${plural(remaining.cells, "cell", "cells")}` : null,
    remaining.photos ? `${remaining.photos} ${plural(remaining.photos, "photo", "photos")}` : null,
    remaining.explanations ? `${remaining.explanations} ${plural(remaining.explanations, "reason", "reasons")}` : null,
    remaining.barcodes ? `${remaining.barcodes} ${plural(remaining.barcodes, "barcode", "barcodes")}` : null,
    remaining.evidence ? `${remaining.evidence} evidence ${plural(remaining.evidence, "item", "items")}` : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} left`;
}

type ServerCompletion = {
  missingRcaCount: number;
  missingEvidenceCount: number;
  missingExpiryCoverageRecords: number;
  issues: { type: string; label?: string; count?: number }[];
};

/** Plain-English lines for the server-side completion check. */
export function describeServerIssues(result: ServerCompletion): string[] {
  const out: string[] = [];
  for (const issue of result.issues) {
    const n = Math.max(1, Number(issue.count) || 1);
    switch (issue.type) {
      case "missing_assignment":
        out.push("We couldn't find this audit. It may have been removed or reassigned — refresh the page.");
        break;
      case "forbidden":
        out.push("This audit is assigned to someone else, so it can't be submitted from your account.");
        break;
      case "row_photo":
        out.push(`${n} ${plural(n, "row still needs", "rows still need")} a photo.`);
        break;
      case "shelf_photo":
        out.push(`${n} ${plural(n, "shelf still needs", "shelves still need")} a photo.`);
        break;
      case "before_after":
        out.push(`${n} ${plural(n, "shelf still needs", "shelves still need")} a before and after photo.`);
        break;
      case "barcode":
        out.push(`${n} ${plural(n, "row still needs", "rows still need")} a barcode scan.`);
        break;
      case "variance_explanation":
        out.push(`${n} ${plural(n, "row with a difference still needs", "rows with a difference still need")} a reason.`);
        break;
      default:
        if (issue.label) out.push(`${friendlyLabel(issue.label)} is still missing.`);
    }
  }
  if (!out.length) {
    if (result.missingRcaCount) {
      out.push(`${result.missingRcaCount} ${plural(result.missingRcaCount, "difference still needs", "differences still need")} a reason.`);
    }
    if (result.missingEvidenceCount) {
      out.push(`${result.missingEvidenceCount} required evidence ${plural(result.missingEvidenceCount, "item is", "items are")} still missing.`);
    }
  }
  if (result.missingExpiryCoverageRecords) {
    const n = result.missingExpiryCoverageRecords;
    out.push(`${n} ${plural(n, "item still needs", "items still need")} an expiry date check.`);
  }
  return out.length ? out : ["Some required items are still missing."];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A submit failure the page can show as a clear list instead of a toast. */
export class AuditSubmitError extends Error {
  readonly title: string;
  readonly items: string[];
  constructor(title: string, items: string[]) {
    super(items.length ? `${title} ${items.join(" ")}` : title);
    this.name = "AuditSubmitError";
    this.title = title;
    this.items = items;
  }
}
