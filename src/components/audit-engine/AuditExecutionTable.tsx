import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Camera, Copy, Download, Info, Loader2, Plus, ScanBarcode, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { TablePager, usePager } from "@/components/design-system/TablePager";
import { EvidenceImage } from "@/components/audit-builder/AuditExecutionForm";
import { useEvidenceUpload } from "@/components/audit-builder/useEvidenceUpload";
import { ExpiryStatusPill, formatIsoDate } from "@/components/audit-engine/ExpiryStatusPill";
import { SubmitBlockersPanel, type SubmitProblem } from "@/components/audit-engine/SubmitBlockersPanel";
import { useAuditEvidenceCapture } from "@/components/audit-engine/useAuditEvidenceCapture";
import { BarcodeScannerDialog } from "@/components/digital-audit/BarcodeScannerDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { computeCalculatedValues } from "@/lib/audit-builder/calculated-fields";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import { computeCompletion } from "@/lib/audit-builder/validation";
import {
  activeEvidenceFlags,
  auditDisplayId,
  buildExecutionColumns,
  buildFillCsv,
  cellText,
  encodeEvidenceFlag,
  EVIDENCE_FLAGS_KEY,
  EVIDENCE_STATUS_KEY,
  EVIDENCE_STATUS_LABEL,
  evidenceCheck,
  photoList,
  repeatableSectionKey,
  resolveRowEvidence,
  timeLeft,
  validateFilledUpload,
  verifyPair,
  withNumericPairs,
  type EvidenceStatus,
  type ExecutionColumn,
  type PairStatus,
  type UploadValidation,
} from "@/lib/audit-engine/execution-table";
import {
  EXPIRY_REMOVAL_PHOTO_KEY,
  EXPIRY_REMOVED_KEY,
  EXPIRY_SCAN_DATE_KEY,
  EXPIRY_SCAN_ITEM_KEY,
  EXPIRY_SCAN_PHOTO_KEY,
  EXPIRY_SCAN_READ_KEY,
  EXPIRY_SCAN_STATUS_KEY,
  classifyExpiry,
  localIsoDate,
  rowExpiryState,
  type ExpiryReading,
  type RowExpiry,
} from "@/lib/audit-engine/expiry-evidence";
import { readExpiryDateFromPhoto } from "@/lib/audit-engine/expiry-read-client";
import {
  BARCODE_SCAN_KEY,
  ROW_VARIANCE_KEY,
  VARIANCE_NOTE_KEY,
  VARIANCE_REASON_KEY,
  barcodeMatches,
  evaluateGridEvidence,
  evidenceField,
  gridEvidenceColumns,
  listValue,
  rowExpectedBarcode,
  shelfSlots,
} from "@/lib/audit-engine/grid-evidence";
import { policyNearExpiryDays } from "@/lib/audit-evidence-policy";
import {
  computeSubmitReadiness,
  remainingSummary,
  type ReadinessRow,
  type SubmitBlocker,
} from "@/lib/audit-engine/submit-readiness";
import { parseAuditSpreadsheet } from "@/lib/audit-input-dataset";
import type { CustomAuditSession, ResponseMap } from "@/lib/custom-audit";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import { cn } from "@/lib/utils";

type SaveItem = { recordIndex: number; field: TemplateField; value: AuditResponseValue };

type Props = {
  session: CustomAuditSession;
  responses: ResponseMap;
  onChange: Dispatch<SetStateAction<ResponseMap>>;
  onSaveField: (sectionKey: string, recordIndex: number, field: TemplateField, value: AuditResponseValue) => Promise<void>;
  onSaveMany: (sectionKey: string, items: SaveItem[]) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadVideo?: (file: File) => Promise<string>;
  readOnly: boolean;
  testMode?: boolean;
  submitting: boolean;
  onSubmit: () => void;
  submitProblem?: SubmitProblem | null;
  onDismissSubmitProblem?: () => void;
};

const ROLE_CHIP: Record<ExecutionColumn["role"] | "verification", { label: string; tint: string; border: string }> = {
  provided: { label: "PROVIDED", tint: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  fill: { label: "YOU FILL", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
  evidence: { label: "YOU FILL", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
  calculated: { label: "CALCULATED", tint: ACCENT_TINT.grey, border: AISLIX_PALETTE.border },
  verification: { label: "VERIFICATION", tint: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
};

const PAIR_PILL: Record<PairStatus, { label: string; background: string; border: string }> = {
  match: { label: "Match", background: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
  mismatch: { label: "Mismatch", background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.border },
  not_filled: { label: "Not filled", background: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

const EVIDENCE_PILL: Record<EvidenceStatus, { background: string; border: string; dashed?: boolean }> = {
  verified: { background: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
  needs_review: { background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.border },
  missing: { background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.secondary, dashed: true },
  not_required: { background: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Submitted",
  pending_review: "Pending review",
};

function formatDiff(value: number): string {
  const abs = Math.abs(value) % 1 === 0 ? String(Math.abs(value)) : Math.abs(value).toFixed(2);
  return value > 0 ? `+${abs}` : value < 0 ? `−${abs}` : abs;
}

function Chip({ role }: { role: keyof typeof ROLE_CHIP }) {
  const chip = ROLE_CHIP[role];
  return (
    <span
      className="mt-1 inline-block whitespace-nowrap rounded px-1.5 py-px text-[9px] font-semibold tracking-wide text-[#102A43]"
      style={{ background: chip.tint, boxShadow: `inset 0 0 0 1px ${chip.border}` }}
    >
      {chip.label}
    </span>
  );
}

function Pill({ label, background, border, dashed, title }: { label: string; background: string; border: string; dashed?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium text-[#102A43]"
      style={{ background, border: `1px ${dashed ? "dashed" : "solid"} ${border}` }}
    >
      {label}
      {title ? <Info className="size-3 text-[#667085]" /> : null}
    </span>
  );
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">{label}</p>
      <div className="mt-0.5 truncate text-sm text-[#102A43]">{children}</div>
    </div>
  );
}

const CELL_CLASS =
  "h-8 w-full min-w-[7rem] rounded-md border bg-white px-2 text-xs text-[#102A43] outline-none transition-colors focus:border-[#9B86D9] disabled:cursor-not-allowed disabled:opacity-70";

function CellEditor({
  column,
  value,
  disabled,
  onCommit,
}: {
  column: ExecutionColumn;
  value: AuditResponseValue | undefined;
  disabled: boolean;
  onCommit: (value: AuditResponseValue) => void;
}) {
  const external = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(external);
  useEffect(() => setDraft(external), [external]);
  const empty = !external;
  const border = column.required && empty ? AISLIX_PALETTE.purple : AISLIX_PALETTE.border;

  if (column.kind === "select" || column.kind === "rca") {
    const options =
      column.kind === "rca"
        ? RCA_OPTIONS.map((o) => ({ value: o.code, label: o.label }))
        : (column.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <select
        aria-label={column.label}
        disabled={disabled}
        className={CELL_CLASS}
        style={{ borderColor: border }}
        value={external}
        onChange={(e) => onCommit(e.target.value || null)}
      >
        <option value="">{column.required ? "Required" : "Select…"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const commit = () => {
    if (draft === external) return;
    if (column.kind === "number") {
      if (draft.trim() === "") return onCommit(null);
      const n = Number(draft);
      if (!Number.isFinite(n)) {
        toast.error(`${column.label}: enter a number`);
        setDraft(external);
        return;
      }
      return onCommit(n);
    }
    onCommit(draft.trim() === "" ? null : draft);
  };

  return (
    <input
      aria-label={column.label}
      disabled={disabled}
      type={column.kind === "number" ? "number" : column.kind === "date" ? "date" : "text"}
      inputMode={column.kind === "number" ? "decimal" : undefined}
      title={column.kind === "long_text" ? draft : undefined}
      placeholder={column.required ? "Required" : column.field.config.placeholder}
      className={cn(CELL_CLASS, column.kind === "number" && "text-right tabular-nums", column.kind === "long_text" && "min-w-[12rem]")}
      style={{ borderColor: border }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function AuditExecutionTable({
  session,
  responses,
  onChange,
  onSaveField,
  onSaveMany,
  onUploadImage,
  onUploadVideo,
  readOnly,
  testMode,
  submitting,
  onSubmit,
  submitProblem = null,
  onDismissSubmitProblem,
}: Props) {
  const { definition } = session;
  const sectionKey = repeatableSectionKey(definition) ?? "records";
  const baseColumns = useMemo(
    () => buildExecutionColumns(definition, session.inputSchema),
    [definition, session.inputSchema],
  );
  const fieldByKey = useMemo(() => new Map(definition.fields.map((f) => [f.key, f])), [definition]);
  const statusField = definition.fields.find((f) => f.section === sectionKey && f.key === EVIDENCE_STATUS_KEY);
  const flagsField = definition.fields.find((f) => f.section === sectionKey && f.key === EVIDENCE_FLAGS_KEY);
  const rowEvidence = useMemo(
    () =>
      resolveRowEvidence({
        definition,
        purposeConfig: session.template.purpose_config,
        evidencePolicy: session.evidencePolicy,
      }),
    [definition, session.template.purpose_config, session.evidencePolicy],
  );
  const evidenceKey = rowEvidence.field?.key ?? null;
  const hasProvidedData = Boolean(session.inputDataset?.rows.length);
  const headerSections = definition.sections.filter((s) => !s.repeatable).sort((a, b) => a.order - b.order);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [rowQuery, setRowQuery] = useState("");
  const deferredRowQuery = useDeferredValue(rowQuery.trim().toLowerCase());
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [memoryFlags, setMemoryFlags] = useState<Record<string, string[]>>({});
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<{ recordIndex: number; field: TemplateField } | null>(null);
  const [preview, setPreview] = useState<{ filename: string; result: UploadValidation } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceUpload = useEvidenceUpload(onUploadImage);

  const recordIndexes = useMemo(() => {
    const keys = Object.keys(responses[sectionKey] ?? {}).map(Number).sort((a, b) => a - b);
    return keys.length ? keys : [0];
  }, [responses, sectionKey]);

  const columns = useMemo(
    () =>
      withNumericPairs(
        baseColumns,
        recordIndexes.map((index) => ({ index, values: responses[sectionKey]?.[index] ?? {} })),
      ),
    [baseColumns, recordIndexes, responses, sectionKey],
  );
  const pairs = columns.filter((c) => c.compareWithKey);

  const rows = recordIndexes.map((index, position) => {
    const raw = responses[sectionKey]?.[index] ?? {};
    const values = { ...raw, ...computeCalculatedValues(definition, raw) } as Record<string, AuditResponseValue | undefined>;
    const pairResults = new Map(pairs.map((c) => [c.key, verifyPair(values[c.compareWithKey!], values[c.key])]));
    const hasMismatch = [...pairResults.values()].some((r) => r.status === "mismatch");
    const photos = evidenceKey ? photoList(values[evidenceKey]) : [];
    const flags = [
      ...activeEvidenceFlags(values[EVIDENCE_FLAGS_KEY], photos),
      ...photos.flatMap((url) => memoryFlags[url] ?? []),
    ];
    const evidence = evidenceCheck({
      mode: rowEvidence.mode,
      photos,
      minimumPhotos: rowEvidence.minimumPhotos,
      flags,
      hasMismatch,
    });
    return { index, position, values, pairResults, photos, evidence, hasMismatch };
  });

  const gridColumns = useMemo(
    () => gridEvidenceColumns(session.template.purpose_config as Record<string, unknown> | null),
    [session.template.purpose_config],
  );
  const requiredProof = session.evidencePolicy?.requiredProof ?? [];
  const requireRca = Boolean(session.requireRca);
  const needsExpiry = requiredProof.includes("expiry_date");
  const nearExpiryDays = policyNearExpiryDays(session.evidencePolicy);
  const today = localIsoDate(new Date(now));
  const slots = useMemo(
    () => shelfSlots(session.inputDataset, gridColumns.shelfColumnId),
    [session.inputDataset, gridColumns.shelfColumnId],
  );
  const showBarcodeColumn = requiredProof.includes("barcode") && Boolean(gridColumns.barcodeColumnId);
  const showVarianceColumns = requireRca && pairs.length > 0;
  const requirements = evaluateGridEvidence({
    policy: session.evidencePolicy,
    requireRca,
    dataset: session.inputDataset,
    columns: gridColumns,
    rows: rows.map((r) => ({
      index: r.index,
      position: r.position,
      values: r.values,
      hasMismatch: r.hasMismatch,
      rowEvidenceStatus: r.evidence.status,
    })),
    responses,
    today,
  });
  const expiryByRow = new Map(
    needsExpiry ? rows.map((r) => [r.index, rowExpiryState(r.values, today, nearExpiryDays)] as const) : [],
  );

  const nonRepeatable = headerSections.map((s) => ({
    sectionKey: s.key,
    recordIndex: 0,
    values: responses[s.key]?.[0] ?? {},
  }));
  const completion = computeCompletion(definition, [
    ...rows.map((r) => ({ sectionKey, recordIndex: r.index, values: responses[sectionKey]?.[r.index] ?? {} })),
    ...nonRepeatable,
  ]);
  const readinessRows: ReadinessRow[] = rows.map((r) => {
    const photoNeeded = rowEvidence.mode === "required" || (rowEvidence.mode === "on_mismatch" && r.hasMismatch);
    const reasonNeeded = requireRca && r.hasMismatch;
    const reason = cellText(r.values[VARIANCE_REASON_KEY]);
    const barcodeNeeded =
      requiredProof.includes("barcode") &&
      Boolean(rowExpectedBarcode(session.inputDataset, gridColumns.barcodeColumnId, r.index));
    return {
      index: r.index,
      position: r.position,
      photoNeeded,
      photoMissing: r.evidence.status === "missing",
      photoNeedsReview: r.evidence.status === "needs_review",
      reasonNeeded,
      reasonMissing: reasonNeeded && (!reason || (reason === "other" && !cellText(r.values[VARIANCE_NOTE_KEY]))),
      barcodeNeeded,
      barcodeMissing: barcodeNeeded && !cellText(r.values[BARCODE_SCAN_KEY]),
      expiryNeeded: needsExpiry,
      expiryMissing: Boolean(expiryByRow.get(r.index)?.dateMissing),
      removalNeeded: expiryByRow.get(r.index)?.status === "expired",
      removalMissing: Boolean(expiryByRow.get(r.index)?.removalMissing),
    };
  });
  const readiness = computeSubmitReadiness({
    definition,
    sectionKey,
    completion,
    rows: readinessRows,
    requirements,
    photoRule: rowEvidence.mode === "required" ? "every_row" : rowEvidence.mode === "on_mismatch" ? "on_difference" : "none",
    requiredPhotoFieldKey: rowEvidence.mode === "required" && rowEvidence.field?.required ? rowEvidence.field.key : null,
    columnLabels: new Map(columns.map((c) => [c.key, c.label])),
  });
  const leftSummary = remainingSummary(readiness.remaining);
  const evidenceCounts = {
    verified: rows.filter((r) => r.evidence.status === "verified").length,
    needs_review: rows.filter((r) => r.evidence.status === "needs_review").length,
    missing: rows.filter((r) => r.evidence.status === "missing").length,
  };
  const reviewCount = readiness.reviewRowPositions.length;
  const reviewNotice = reviewCount
    ? `Photos on ${reviewCount === 1 ? "1 row are" : `${reviewCount} rows are`} flagged for review (for example a duplicate or unclear photo, or fewer photos than asked for). This doesn't stop you submitting — a reviewer will check ${reviewCount === 1 ? "it" : "them"}.`
    : null;

  // Persist each row's evidence result so the results page shows the same validation.
  const statusSignature = rows
    .map((r) => `${r.index}:${[r.evidence.status, ...r.evidence.reasons].join("|")}`)
    .join(";");
  useEffect(() => {
    if (!statusField || readOnly || rowEvidence.mode === "off") return;
    const timer = window.setTimeout(() => {
      const items: SaveItem[] = [];
      for (const r of rows) {
        const next = [r.evidence.status, ...r.evidence.reasons];
        const stored = r.values[EVIDENCE_STATUS_KEY];
        const storedText = Array.isArray(stored) ? stored.join("|") : null;
        if (storedText === null && r.evidence.status === "not_required") continue;
        if (storedText === next.join("|")) continue;
        items.push({ recordIndex: r.index, field: statusField, value: next });
      }
      if (!items.length) return;
      onChange((prev) => {
        const section = { ...(prev[sectionKey] ?? {}) };
        for (const item of items) section[item.recordIndex] = { ...(section[item.recordIndex] ?? {}), [EVIDENCE_STATUS_KEY]: item.value };
        return { ...prev, [sectionKey]: section };
      });
      void onSaveMany(sectionKey, items).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusSignature, statusField, readOnly, rowEvidence.mode]);

  const setValue = async (sec: string, recordIndex: number, field: TemplateField, value: AuditResponseValue) => {
    onChange((prev) => ({
      ...prev,
      [sec]: { ...(prev[sec] ?? {}), [recordIndex]: { ...(prev[sec]?.[recordIndex] ?? {}), [field.key]: value } },
    }));
    if (readOnly) return;
    try {
      await onSaveField(sec, recordIndex, field, value);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this value.");
    }
  };

  const handlePhoto = async (file: File) => {
    const target = photoTarget;
    if (!target) return;
    const { recordIndex, field } = target;
    const checks = rowEvidence.qualityChecks;
    try {
      const { url, flags } = await evidenceUpload.upload(file, {
        checkQuality:
          Boolean(field.config.imageQualityCheck) || checks.some((c) => c === "blur" || c === "dark" || c === "glare"),
        qualityRequirement: field.config.imageQualityRequirement ?? "standard",
        checkDuplicates:
          checks.includes("duplicate_hash") || Boolean(definition.evidence.preventDuplicates || field.config.duplicateDetection),
        onProblem: "flag",
      });
      const current = photoList(responses[sectionKey]?.[recordIndex]?.[field.key]);
      await setValue(sectionKey, recordIndex, field, [...current, url]);
      if (flags.length) {
        if (flagsField && field.key === evidenceKey) {
          const stored = responses[sectionKey]?.[recordIndex]?.[EVIDENCE_FLAGS_KEY];
          const existing = Array.isArray(stored) ? stored.map(String) : [];
          await setValue(sectionKey, recordIndex, flagsField, [...existing, ...flags.map((f) => encodeEvidenceFlag(url, f))]);
        } else {
          setMemoryFlags((prev) => ({ ...prev, [url]: flags }));
        }
        toast.warning(`Photo added but needs review: ${flags[0]}`, { duration: 6000 });
      } else {
        toast.success("Photo added.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setPhotoTarget((prev) => (prev === target ? null : prev));
    }
  };

  const removePhoto = (recordIndex: number, field: TemplateField, url: string) => {
    const current = photoList(responses[sectionKey]?.[recordIndex]?.[field.key]);
    void setValue(sectionKey, recordIndex, field, current.filter((u) => u !== url));
  };

  const [scanRow, setScanRow] = useState<number | null>(null);
  const [expiryTarget, setExpiryTarget] = useState<{ recordIndex: number; kind: "date" | "removal" } | null>(null);
  const [readingRow, setReadingRow] = useState<number | null>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const evidencePanelRef = useRef<HTMLDivElement>(null);
  const headerSectionsRef = useRef<HTMLDivElement>(null);
  const blockersRef = useRef<HTMLElement>(null);
  const [showBlockers, setShowBlockers] = useState(false);
  const [highlightRows, setHighlightRows] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    if (!highlightRows.size) return;
    const timer = window.setTimeout(() => setHighlightRows(new Set()), 2500);
    return () => window.clearTimeout(timer);
  }, [highlightRows]);
  useEffect(() => {
    if (submitProblem) blockersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitProblem]);
  const canCapture = !readOnly && !testMode;

  const evidenceCapture = useAuditEvidenceCapture({
    responses,
    setValue,
    onUploadImage,
    onUploadVideo,
    requiredProof,
    qualityChecks: rowEvidence.qualityChecks,
    storeLocation: session.storeLocation,
    readOnly,
    canCapture,
  });

  const expiryField = (key: string, type: TemplateField["type"]) => evidenceField(sectionKey, key, type);
  const templateExpiryColumn = needsExpiry
    ? columns.find((c) => c.editable && (c.field.type === "expiry_date" || c.field.standardConcept === "expiry_date"))
    : undefined;
  const itemLabelOf = (row: (typeof rows)[number]) => {
    const text = columns
      .filter((c) => c.kind !== "image" && c.kind !== "number" && c.role !== "calculated")
      .map((c) => cellText(row.values[c.key]))
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ");
    return text || `Row ${row.position + 1}`;
  };

  const saveExpiryDate = async (row: (typeof rows)[number], date: string | null, reading?: ExpiryReading) => {
    const status = date ? classifyExpiry(date, localIsoDate(), nearExpiryDays) : null;
    await setValue(sectionKey, row.index, expiryField(EXPIRY_SCAN_DATE_KEY, "date"), date);
    await setValue(sectionKey, row.index, expiryField(EXPIRY_SCAN_STATUS_KEY, "short_text"), status);
    await setValue(sectionKey, row.index, expiryField(EXPIRY_SCAN_ITEM_KEY, "short_text"), itemLabelOf(row));
    if (reading) await setValue(sectionKey, row.index, expiryField(EXPIRY_SCAN_READ_KEY, "short_text"), JSON.stringify(reading));
    if (date && templateExpiryColumn) await setValue(sectionKey, row.index, templateExpiryColumn.field, date);
  };

  const handleExpiryPhoto = async (file: File) => {
    const target = expiryTarget;
    if (!target) return;
    const row = rows.find((r) => r.index === target.recordIndex);
    if (!row) return;
    const key = target.kind === "date" ? EXPIRY_SCAN_PHOTO_KEY : EXPIRY_REMOVAL_PHOTO_KEY;
    try {
      const { url } = await evidenceUpload.upload(file, { checkQuality: false, checkDuplicates: false, onProblem: "flag" });
      await setValue(sectionKey, row.index, expiryField(key, "multiple_images"), [...listValue(row.values[key]), url]);
      if (target.kind === "removal") {
        toast.success("Removal photo added.");
        return;
      }
      setReadingRow(row.index);
      try {
        const reading = await readExpiryDateFromPhoto(file, itemLabelOf(row));
        if (reading.date) {
          await saveExpiryDate(row, reading.date, reading);
          const status = classifyExpiry(reading.date, localIsoDate(), nearExpiryDays);
          const message = `AI read ${formatIsoDate(reading.date)} for row ${row.position + 1} — check it's right.`;
          if (status === "expired") toast.error(`${message} This product is EXPIRED: remove it from the shelf.`, { duration: 8000 });
          else toast.success(message);
        } else {
          await setValue(sectionKey, row.index, expiryField(EXPIRY_SCAN_READ_KEY, "short_text"), JSON.stringify(reading));
          toast.warning(`AI couldn't read a date on row ${row.position + 1}. Type the date from the pack, or retake the photo closer.`, { duration: 7000 });
        }
      } catch (e) {
        toast.warning(
          `${e instanceof Error ? e.message : "AI couldn't read the date."} Type the date from the pack for row ${row.position + 1}.`,
          { duration: 7000 },
        );
      } finally {
        setReadingRow(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setExpiryTarget((prev) => (prev === target ? null : prev));
    }
  };

  const varianceField = evidenceField(sectionKey, ROW_VARIANCE_KEY, "yes_no");
  const varianceSignature = rows.map((r) => `${r.index}:${r.hasMismatch ? 1 : 0}`).join(";");
  useEffect(() => {
    if (!requireRca || !canCapture) return;
    const timer = window.setTimeout(() => {
      const items: SaveItem[] = rows
        .filter((r) => (r.values[ROW_VARIANCE_KEY] === true) !== r.hasMismatch)
        .map((r) => ({ recordIndex: r.index, field: varianceField, value: r.hasMismatch }));
      if (!items.length) return;
      onChange((prev) => {
        const section = { ...(prev[sectionKey] ?? {}) };
        for (const item of items) section[item.recordIndex] = { ...(section[item.recordIndex] ?? {}), [ROW_VARIANCE_KEY]: item.value };
        return { ...prev, [sectionKey]: section };
      });
      void onSaveMany(sectionKey, items).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varianceSignature, requireRca, canCapture]);

  const barcodeField = evidenceField(sectionKey, BARCODE_SCAN_KEY, "short_text");
  const saveBarcodeRef = useRef<(code: string) => void>(() => undefined);
  saveBarcodeRef.current = (code: string) => {
    if (scanRow === null) return;
    void setValue(sectionKey, scanRow, barcodeField, code);
    toast.success(`Barcode ${code} saved for row ${(rows.find((r) => r.index === scanRow)?.position ?? scanRow) + 1}.`);
  };
  const onBarcodeScanned = useCallback((code: string) => saveBarcodeRef.current(code), []);
  const onScannerOpenChange = useCallback((open: boolean) => {
    if (!open) setScanRow(null);
  }, []);

  const addRow = () => {
    const next = Math.max(-1, ...recordIndexes) + 1;
    onChange((prev) => ({ ...prev, [sectionKey]: { ...(prev[sectionKey] ?? {}), [next]: {} } }));
    setRowQuery("");
    setNeedsAttentionOnly(false);
    pager.setPage(Math.floor(recordIndexes.length / pager.pageSize));
  };

  const displayId = auditDisplayId(session.assignmentId);

  const downloadCsv = () => {
    const csv = buildFillCsv(
      columns,
      rows.map((r) => ({ index: r.index, values: r.values })),
    );
    downloadSectionCsv(displayId, "fill", csv.headers, csv.rows);
  };

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const dataset = await parseAuditSpreadsheet(file);
      const result = validateFilledUpload(
        dataset,
        columns,
        rows.map((r) => ({ index: r.index, values: r.values })),
        { hasProvidedData },
      );
      setPreview({ filename: file.name, result });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyUpload = async () => {
    if (!preview) return;
    const items: SaveItem[] = preview.result.updates.flatMap((u) => {
      const field = fieldByKey.get(u.fieldKey);
      return field ? [{ recordIndex: u.recordIndex, field, value: u.value }] : [];
    });
    setApplying(true);
    try {
      if (!readOnly) await onSaveMany(sectionKey, items);
      onChange((prev) => {
        const section = { ...(prev[sectionKey] ?? {}) };
        for (const index of preview.result.newRecordIndexes) section[index] = { ...(section[index] ?? {}) };
        for (const item of items) section[item.recordIndex] = { ...(section[item.recordIndex] ?? {}), [item.field.key]: item.value };
        return { ...prev, [sectionKey]: section };
      });
      toast.success(`${items.length} value${items.length === 1 ? "" : "s"} filled from ${preview.filename}.`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the uploaded values.");
    } finally {
      setApplying(false);
    }
  };

  const submit = () => {
    onDismissSubmitProblem?.();
    if (!readiness.ready && !testMode) {
      setShowBlockers(true);
      window.requestAnimationFrame(() => blockersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setShowBlockers(false);
    onSubmit();
  };

  const goToBlocker = (blocker: SubmitBlocker) => {
    if (blocker.kind === "evidence") {
      evidencePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (blocker.kind === "header") {
      headerSectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const first = rows.find((r) => blocker.rowIndexes.includes(r.index));
    if (!first) return;
    setRowQuery("");
    setNeedsAttentionOnly(false);
    pager.setPage(Math.floor(first.position / pager.pageSize));
    setHighlightRows(new Set(blocker.rowIndexes));
    window.setTimeout(() => {
      const tr = document.getElementById(`audit-row-${first.index}`);
      tr?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        const target = tr?.querySelector<HTMLElement>(
          blocker.kind === "explanations" ? "select:not([disabled])" : "input:not([disabled]):not([type=file]), select:not([disabled])",
        );
        target?.focus({ preventScroll: true });
      }, 350);
    }, 60);
  };

  const visibleRows = rows.filter(
    (row) =>
      (!needsAttentionOnly || readiness.incompleteRows.has(row.index)) &&
      (!deferredRowQuery ||
        columns.some((c) => (cellText(row.values[c.key]) ?? "").toLowerCase().includes(deferredRowQuery))),
  );
  const pager = usePager(visibleRows.length);
  const pageRows = visibleRows.slice(pager.start, pager.end);

  const auditName = session.auditName || session.template.name;
  const description =
    session.auditDescription || session.template.description?.trim() || session.template.short_description?.trim() || "";
  const instructions = session.instructions?.trim() || "";
  const left = timeLeft(session.dueAt, now);
  const evidenceColumnIndex = columns.findIndex((c) => c.key === evidenceKey);

  return (
    <div className="space-y-4 pb-24">
      {testMode ? (
        <div className="rounded-xl border border-[#D9E2E8] px-4 py-2 text-center text-sm font-medium text-[#102A43]" style={{ background: AISLIX_PALETTE.grey }}>
          TEST MODE — sample data only, not saved to production audits
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#D9E2E8] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-[#102A43]">{auditName}</h2>
            {description ? (
              <p className={cn("mt-1 text-sm text-[#667085]", !showFullDescription && "line-clamp-2")}>
                {description}{" "}
                {description.length > 160 ? (
                  <button type="button" className="font-medium text-[#102A43] underline-offset-2 hover:underline" onClick={() => setShowFullDescription((v) => !v)}>
                    {showFullDescription ? "Less" : "More"}
                  </button>
                ) : null}
              </p>
            ) : null}
            {instructions && instructions !== description ? (
              <p className="mt-1 text-sm text-[#667085]">
                <span className="font-medium text-[#102A43]">Instructions:</span> {instructions}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <DetailItem label="Audit ID">
                <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
                  {displayId}
                  <button
                    type="button"
                    aria-label="Copy audit ID"
                    className="rounded p-0.5 text-[#667085] hover:bg-[#F4F7F9] hover:text-[#102A43]"
                    onClick={() => {
                      void navigator.clipboard?.writeText(displayId);
                      toast.success("Audit ID copied.");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </span>
              </DetailItem>
              <DetailItem label="Store">{session.storeName ?? "—"}</DetailItem>
              <DetailItem label="Assignor">{session.assignerName ?? "—"}</DetailItem>
              <DetailItem label="Assignee">{session.assigneeName ?? "—"}</DetailItem>
              <DetailItem label="Due">{session.dueAt ? new Date(session.dueAt).toLocaleString() : "No due date"}</DetailItem>
              <DetailItem label="Time left">
                {left ? (
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{ background: left.overdue ? AISLIX_PALETTE.pink : ACCENT_TINT.purple, border: `1px solid ${left.overdue ? AISLIX_PALETTE.border : AISLIX_PALETTE.purple}` }}
                  >
                    {left.label}
                  </span>
                ) : (
                  <span className="text-[#667085]">N/A</span>
                )}
              </DetailItem>
              <DetailItem label="Status">
                <span className="inline-block rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: ACCENT_TINT.blue, border: `1px solid ${AISLIX_PALETTE.blue}` }}>
                  {STATUS_LABEL[session.status] ?? session.status.replace(/_/g, " ")}
                </span>
              </DetailItem>
              <DetailItem label="Mode">Digital audit</DetailItem>
            </div>
          </div>
          <div className="lg:w-72 lg:border-l lg:border-[#D9E2E8] lg:pl-5">
            <p className="inline-flex items-center gap-1 text-xs font-medium text-[#667085]">
              Audit Completion
              <span
                title="Share of everything required to submit: required cells, row photos, reasons for differences, barcodes and audit evidence."
                aria-label="Counts required cells, row photos, reasons for differences, barcodes and audit evidence."
              >
                <Info className="size-3" />
              </span>
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[#102A43]">{readiness.percent}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: AISLIX_PALETTE.grey }}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${readiness.percent}%`, background: AISLIX_PALETTE.purple }} />
            </div>
            <p className="mt-1.5 text-xs text-[#667085]">
              {leftSummary ?? "Everything required is done — ready to submit"}
            </p>
            <p className="mt-0.5 text-xs text-[#667085]">
              {readiness.done} of {readiness.total} required item{readiness.total === 1 ? "" : "s"} done
            </p>
            {rowEvidence.mode !== "off" ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-[#667085]">Evidence summary</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#102A43]">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: AISLIX_PALETTE.green }} />{evidenceCounts.verified} verified</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: AISLIX_PALETTE.pink, boxShadow: `inset 0 0 0 1px ${AISLIX_PALETTE.secondary}` }} />{evidenceCounts.needs_review} need review</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: AISLIX_PALETTE.border }} />{evidenceCounts.missing} missing</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div ref={headerSectionsRef} className="scroll-mt-24 space-y-4 empty:hidden">
      {headerSections.map((section) => {
        const fields = definition.fields
          .filter((f) => f.section === section.key && !f.system)
          .sort((a, b) => a.order - b.order);
        if (!fields.length) return null;
        const sectionColumns = buildExecutionColumns(
          { ...definition, sections: [{ ...section, repeatable: true }], fields },
          null,
        );
        return (
          <section key={section.key} className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#102A43]">{section.title}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sectionColumns
                .filter((c) => c.kind !== "image")
                .map((c) => (
                  <label key={c.key} className="block text-xs font-medium text-[#102A43]">
                    {c.label}
                    {c.required ? <span className="text-[#667085]"> *</span> : null}
                    <div className="mt-1">
                      {c.editable ? (
                        <CellEditor
                          column={c}
                          value={responses[section.key]?.[0]?.[c.key]}
                          disabled={readOnly}
                          onCommit={(v) => void setValue(section.key, 0, c.field, v)}
                        />
                      ) : (
                        <p className="rounded-md px-2 py-1.5 text-xs" style={{ background: ACCENT_TINT.blue }}>
                          {cellText(responses[section.key]?.[0]?.[c.key]) ?? "—"}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
            </div>
          </section>
        );
      })}
      </div>

      {requirements.length ? (
        <div ref={evidencePanelRef} className="scroll-mt-24">
          {evidenceCapture.renderPanel(requirements, slots)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
          <span className="font-medium text-[#102A43]">
            {rows.length} row{rows.length === 1 ? "" : "s"} · {columns.length} column{columns.length === 1 ? "" : "s"}
          </span>
          <Chip role="provided" />
          <Chip role="fill" />
          {pairs.length || rowEvidence.mode !== "off" ? <Chip role="verification" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 1 ? (
            <>
              <label className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="search"
                  aria-label="Search rows"
                  placeholder="Search rows"
                  className="h-8 w-44 rounded-md border border-[#D9E2E8] bg-white pl-7 pr-2 text-xs text-[#102A43] outline-none focus:border-[#7DB7D6]"
                  value={rowQuery}
                  onChange={(e) => {
                    setRowQuery(e.target.value);
                    pager.setPage(0);
                  }}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#102A43]">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[#102A43]"
                  checked={needsAttentionOnly}
                  onChange={(e) => {
                    setNeedsAttentionOnly(e.target.checked);
                    pager.setPage(0);
                  }}
                />
                Rows that need something
              </label>
            </>
          ) : null}
          {!hasProvidedData && !readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> Add row
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="size-3.5" /> Download CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || parsing}
            onClick={() => fileInputRef.current?.click()}
            title="Upload your filled copy (CSV or Excel)"
          >
            {parsing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload filled file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-[#D9E2E8] bg-white shadow-sm">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-[#F4F7F9] text-left text-[11px] text-[#102A43]">
            <tr>
              <th className="sticky left-0 z-30 border-b border-[#D9E2E8] bg-[#F4F7F9] px-3 py-2 font-semibold">Row #</th>
              {columns.map((c, i) => (
                <HeaderCells
                  key={c.key}
                  column={c}
                  compareLabel={c.compareWithKey ? columns.find((p) => p.key === c.compareWithKey)?.label : undefined}
                  showEvidenceValidation={i === evidenceColumnIndex && rowEvidence.mode !== "off"}
                />
              ))}
              {showBarcodeColumn ? (
                <th className="border-b border-[#D9E2E8] px-3 py-2 align-top font-semibold">
                  <span className="block whitespace-nowrap">Barcode scan</span>
                  <Chip role="fill" />
                </th>
              ) : null}
              {needsExpiry ? (
                <th className="border-b border-[#D9E2E8] px-3 py-2 align-top font-semibold">
                  <span className="block whitespace-nowrap">Expiry date</span>
                  <Chip role="fill" />
                  <span className="block text-[10px] font-normal text-[#667085]">
                    Photo · AI reads it · near expiry ≤ {nearExpiryDays} day{nearExpiryDays === 1 ? "" : "s"}
                  </span>
                </th>
              ) : null}
              {showVarianceColumns ? (
                <>
                  <th className="border-b border-[#D9E2E8] px-3 py-2 align-top font-semibold">
                    <span className="block whitespace-nowrap">Reason for difference</span>
                    <Chip role="fill" />
                  </th>
                  <th className="border-b border-[#D9E2E8] px-3 py-2 align-top font-semibold">
                    <span className="block whitespace-nowrap">Note</span>
                    <Chip role="fill" />
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const incomplete = readiness.incompleteRows.has(row.index);
              const highlighted = highlightRows.has(row.index);
              return (
                <tr
                  key={row.index}
                  id={`audit-row-${row.index}`}
                  className="scroll-mt-24 align-middle transition-colors duration-300"
                  style={highlighted ? { background: ACCENT_TINT.pink } : undefined}
                >
                  <td
                    className="sticky left-0 z-10 border-b border-[#D9E2E8] bg-white px-3 py-1.5 tabular-nums text-[#667085]"
                    style={{
                      ...(incomplete ? { boxShadow: `inset 3px 0 0 ${AISLIX_PALETTE.purple}` } : {}),
                      ...(highlighted ? { background: AISLIX_PALETTE.pink } : {}),
                    }}
                    title={incomplete ? "This row still needs something before you can submit" : undefined}
                  >
                    {row.position + 1}
                  </td>
                  {columns.map((c, i) => (
                    <RowCells
                      key={c.key}
                      column={c}
                      row={row}
                      readOnly={readOnly}
                      uploading={evidenceUpload.uploading && photoTarget?.recordIndex === row.index && photoTarget.field.key === c.key}
                      minimumPhotos={c.key === evidenceKey ? rowEvidence.minimumPhotos : c.field.config.minImages ?? 0}
                      showEvidenceValidation={i === evidenceColumnIndex && rowEvidence.mode !== "off"}
                      onCommit={(v) => void setValue(sectionKey, row.index, c.field, v)}
                      onAddPhoto={() => {
                        setPhotoTarget({ recordIndex: row.index, field: c.field });
                        photoInputRef.current?.click();
                      }}
                      onRemovePhoto={(url) => removePhoto(row.index, c.field, url)}
                    />
                  ))}
                  {showBarcodeColumn ? (
                    <td className="border-b border-[#D9E2E8] px-2 py-1.5">
                      <BarcodeCell
                        expected={rowExpectedBarcode(session.inputDataset, gridColumns.barcodeColumnId, row.index)}
                        scanned={cellText(row.values[BARCODE_SCAN_KEY])}
                        disabled={readOnly}
                        onScan={() => setScanRow(row.index)}
                        onCommit={(code) => void setValue(sectionKey, row.index, barcodeField, code)}
                      />
                    </td>
                  ) : null}
                  {needsExpiry ? (
                    <td className="border-b border-[#D9E2E8] px-2 py-1.5">
                      <ExpiryCell
                        rowNumber={row.position + 1}
                        state={expiryByRow.get(row.index)!}
                        today={today}
                        disabled={readOnly}
                        reading={readingRow === row.index}
                        uploading={evidenceUpload.uploading && expiryTarget?.recordIndex === row.index}
                        onAddPhoto={(kind) => {
                          setExpiryTarget({ recordIndex: row.index, kind });
                          expiryInputRef.current?.click();
                        }}
                        onRemovePhoto={(kind, url) => {
                          const key = kind === "date" ? EXPIRY_SCAN_PHOTO_KEY : EXPIRY_REMOVAL_PHOTO_KEY;
                          void setValue(
                            sectionKey,
                            row.index,
                            expiryField(key, "multiple_images"),
                            listValue(row.values[key]).filter((u) => u !== url),
                          );
                        }}
                        onDate={(date) => void saveExpiryDate(row, date)}
                        onRemoved={(removed) => void setValue(sectionKey, row.index, expiryField(EXPIRY_REMOVED_KEY, "yes_no"), removed)}
                      />
                    </td>
                  ) : null}
                  {showVarianceColumns ? (
                    row.hasMismatch ? (
                      <>
                        <td className="border-b border-[#D9E2E8] px-2 py-1.5">
                          <select
                            aria-label={`Reason for difference row ${row.position + 1}`}
                            disabled={readOnly}
                            className={CELL_CLASS}
                            style={{ borderColor: cellText(row.values[VARIANCE_REASON_KEY]) ? AISLIX_PALETTE.border : AISLIX_PALETTE.purple }}
                            value={cellText(row.values[VARIANCE_REASON_KEY]) ?? ""}
                            onChange={(e) =>
                              void setValue(sectionKey, row.index, evidenceField(sectionKey, VARIANCE_REASON_KEY, "rca"), e.target.value || null)
                            }
                          >
                            <option value="">Required</option>
                            {RCA_OPTIONS.map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-[#D9E2E8] px-2 py-1.5">
                          <CellEditor
                            column={{
                              key: VARIANCE_NOTE_KEY,
                              label: `Note row ${row.position + 1}`,
                              field: evidenceField(sectionKey, VARIANCE_NOTE_KEY, "notes"),
                              kind: "long_text",
                              editable: true,
                              role: "fill",
                              required: cellText(row.values[VARIANCE_REASON_KEY]) === "other",
                            }}
                            value={row.values[VARIANCE_NOTE_KEY]}
                            disabled={readOnly}
                            onCommit={(v) => void setValue(sectionKey, row.index, evidenceField(sectionKey, VARIANCE_NOTE_KEY, "notes"), v)}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border-b border-[#D9E2E8] px-3 py-1.5 text-[#667085]">—</td>
                        <td className="border-b border-[#D9E2E8] px-3 py-1.5 text-[#667085]">—</td>
                      </>
                    )
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleRows.length ? (
          <p className="px-4 py-6 text-center text-xs text-[#667085]">
            {needsAttentionOnly && !deferredRowQuery ? "Every row has what it needs." : "No rows match your search."}
          </p>
        ) : null}
      </div>
      {rows.length > 10 || visibleRows.length !== rows.length ? (
        <TablePager pager={pager} noun="rows" className="rounded-xl border border-[#D9E2E8] bg-white" />
      ) : null}
      <p className="text-[11px] text-[#667085]">
        Difference = your value − provided value, shown when both are numbers. Download the CSV to fill it offline, then
        upload it back — values are checked here before anything is saved. Photos are added on screen. A purple bar on
        the row number means that row still needs something.
      </p>

      {showBlockers || submitProblem ? (
        <SubmitBlockersPanel
          ref={blockersRef}
          blockers={testMode ? [] : readiness.blockers}
          problem={submitProblem}
          notice={reviewNotice}
          onGoTo={goToBlocker}
          onDismissProblem={onDismissSubmitProblem}
        />
      ) : null}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhoto(file);
          else setPhotoTarget(null);
          e.target.value = "";
        }}
      />
      {evidenceCapture.hiddenInputs}
      <input
        ref={expiryInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleExpiryPhoto(file);
          else setExpiryTarget(null);
          e.target.value = "";
        }}
      />
      <BarcodeScannerDialog open={scanRow !== null} onOpenChange={onScannerOpenChange} onScan={onBarcodeScanned} />

      <div className="sticky bottom-0 z-30 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E2E8] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(16,42,67,0.06)]">
        <p className="text-sm text-[#102A43]">
          <span className="font-semibold">{readiness.rowsComplete}</span> of {readiness.rowsTotal} rows complete
          <span className="text-[#667085]"> · {leftSummary ?? "ready to submit"}</span>
        </p>
        <Button onClick={submit} disabled={submitting || readOnly}>
          {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {testMode ? "Validate test audit" : "Submit audit"}
        </Button>
      </div>

      <UploadPreviewDialog
        preview={preview}
        applying={applying}
        onCancel={() => setPreview(null)}
        onApply={() => void applyUpload()}
      />
    </div>
  );
}

function HeaderCells({
  column,
  compareLabel,
  showEvidenceValidation,
}: {
  column: ExecutionColumn;
  compareLabel?: string;
  showEvidenceValidation: boolean;
}) {
  const th = "border-b border-[#D9E2E8] px-3 py-2 align-top font-semibold";
  return (
    <>
      <th className={cn(th, column.kind === "number" && "text-right")}>
        <span className="block whitespace-nowrap">
          {column.label}
          {column.required ? <span className="text-[#667085]"> *</span> : null}
        </span>
        <Chip role={column.role} />
        {compareLabel ? <span className="block text-[10px] font-normal text-[#667085]">vs {compareLabel}</span> : null}
      </th>
      {column.compareWithKey ? (
        <>
          <th className={cn(th, "text-right")} title={`${column.label} − ${compareLabel ?? "provided"}`}>
            <span className="block whitespace-nowrap">Difference</span>
            <Chip role="verification" />
          </th>
          <th className={th}>
            <span className="block whitespace-nowrap">Status</span>
            <Chip role="verification" />
          </th>
        </>
      ) : null}
      {showEvidenceValidation ? (
        <th className={th}>
          <span className="block whitespace-nowrap">Evidence validation</span>
          <Chip role="verification" />
        </th>
      ) : null}
    </>
  );
}

type TableRow = {
  index: number;
  position: number;
  values: Record<string, AuditResponseValue | undefined>;
  pairResults: Map<string, { difference: number | null; status: PairStatus }>;
  photos: string[];
  evidence: { status: EvidenceStatus; reasons: string[] };
};

function RowCells({
  column,
  row,
  readOnly,
  uploading,
  minimumPhotos,
  showEvidenceValidation,
  onCommit,
  onAddPhoto,
  onRemovePhoto,
}: {
  column: ExecutionColumn;
  row: TableRow;
  readOnly: boolean;
  uploading: boolean;
  minimumPhotos: number;
  showEvidenceValidation: boolean;
  onCommit: (value: AuditResponseValue) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (url: string) => void;
}) {
  const td = "border-b border-[#D9E2E8] px-2 py-1.5";
  const value = row.values[column.key];
  let cell: ReactNode;

  if (column.kind === "image") {
    const photos = photoList(value);
    const max = column.field.config.maxImages ?? 6;
    cell = (
      <div className="flex items-center gap-1.5">
        {photos.map((url) => (
          <span key={url} className="group relative">
            <EvidenceImage stored={url} className="size-8 rounded border border-[#D9E2E8] object-cover" />
            {!readOnly ? (
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute -right-1 -top-1 hidden rounded-full border border-[#D9E2E8] bg-white p-px text-[#667085] group-hover:block"
                onClick={() => onRemovePhoto(url)}
              >
                <X className="size-2.5" />
              </button>
            ) : null}
          </span>
        ))}
        {!readOnly && photos.length < max ? (
          <button
            type="button"
            aria-label={`Add photo for row ${row.position + 1}`}
            disabled={uploading}
            className="inline-flex size-8 items-center justify-center rounded border border-dashed border-[#9B86D9] text-[#667085] hover:bg-[#F3EFFB]"
            onClick={onAddPhoto}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </button>
        ) : null}
        <span className="ml-0.5 whitespace-nowrap text-[11px] tabular-nums text-[#667085]">
          {photos.length}/{Math.max(minimumPhotos, 1)}
        </span>
      </div>
    );
  } else if (column.editable) {
    cell = <CellEditor column={column} value={value} disabled={readOnly} onCommit={onCommit} />;
  } else {
    const text =
      column.kind === "rca" ? RCA_OPTIONS.find((o) => o.code === cellText(value))?.label ?? cellText(value) : cellText(value);
    cell = (
      <span className={cn("block whitespace-nowrap", column.kind === "number" && "text-right tabular-nums")}>
        {text ?? <span className="text-[#667085]">—</span>}
      </span>
    );
  }

  const pair = row.pairResults.get(column.key);
  const evidencePill = EVIDENCE_PILL[row.evidence.status];

  return (
    <>
      <td
        className={cn(td, column.role === "provided" && "text-[#102A43]")}
        style={column.role === "provided" || column.role === "calculated" ? { background: column.role === "provided" ? ACCENT_TINT.blue : ACCENT_TINT.grey } : undefined}
      >
        {cell}
      </td>
      {pair ? (
        <>
          <td className={cn(td, "text-right tabular-nums")}>
            {pair.difference === null ? (
              <span className="text-[#667085]" title="Needs a number in both columns">N/A</span>
            ) : (
              <span className="text-[#102A43]">{formatDiff(pair.difference)}</span>
            )}
          </td>
          <td className={td}>
            <Pill {...PAIR_PILL[pair.status]} />
          </td>
        </>
      ) : null}
      {showEvidenceValidation ? (
        <td className={td}>
          <Pill
            label={EVIDENCE_STATUS_LABEL[row.evidence.status]}
            background={evidencePill.background}
            border={evidencePill.border}
            dashed={evidencePill.dashed}
            title={row.evidence.reasons.length ? row.evidence.reasons.join("\n") : undefined}
          />
        </td>
      ) : null}
    </>
  );
}

function BarcodeCell({
  expected,
  scanned,
  disabled,
  onScan,
  onCommit,
}: {
  expected: string | null;
  scanned: string | null;
  disabled: boolean;
  onScan: () => void;
  onCommit: (code: string | null) => void;
}) {
  const [draft, setDraft] = useState(scanned ?? "");
  useEffect(() => setDraft(scanned ?? ""), [scanned]);
  if (!expected) return <span className="text-[#667085]" title="No barcode in the file for this row">N/A</span>;
  const match = scanned ? barcodeMatches(expected, scanned) : null;
  return (
    <div className="flex items-center gap-1.5">
      <input
        aria-label="Scanned barcode"
        disabled={disabled}
        placeholder="Scan or type"
        className={cn(CELL_CLASS, "w-36 min-w-[8rem] font-mono")}
        style={{ borderColor: scanned ? AISLIX_PALETTE.border : AISLIX_PALETTE.purple }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim() || null;
          if (next !== (scanned ?? null)) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {!disabled ? (
        <button
          type="button"
          aria-label="Scan barcode with camera"
          title="Scan with camera"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded border border-dashed border-[#9B86D9] text-[#667085] hover:bg-[#F3EFFB]"
          onClick={onScan}
        >
          <ScanBarcode className="size-3.5" />
        </button>
      ) : null}
      {match === null ? null : (
        <Pill
          {...(match ? PAIR_PILL.match : PAIR_PILL.mismatch)}
          title={match ? undefined : `Expected ${expected}`}
        />
      )}
    </div>
  );
}

function ExpiryThumbs({ urls, disabled, onRemove }: { urls: string[]; disabled: boolean; onRemove: (url: string) => void }) {
  return (
    <>
      {urls.map((url) => (
        <span key={url} className="group relative shrink-0">
          <EvidenceImage stored={url} className="size-8 rounded border border-[#D9E2E8] object-cover" />
          {!disabled ? (
            <button
              type="button"
              aria-label="Remove photo"
              className="absolute -right-1 -top-1 hidden rounded-full border border-[#D9E2E8] bg-white p-px text-[#667085] group-hover:block"
              onClick={() => onRemove(url)}
            >
              <X className="size-2.5" />
            </button>
          ) : null}
        </span>
      ))}
    </>
  );
}

function ExpiryCell({
  rowNumber,
  state,
  today,
  disabled,
  reading,
  uploading,
  onAddPhoto,
  onRemovePhoto,
  onDate,
  onRemoved,
}: {
  rowNumber: number;
  state: RowExpiry;
  today: string;
  disabled: boolean;
  reading: boolean;
  uploading: boolean;
  onAddPhoto: (kind: "date" | "removal") => void;
  onRemovePhoto: (kind: "date" | "removal", url: string) => void;
  onDate: (date: string | null) => void;
  onRemoved: (removed: boolean) => void;
}) {
  const [draft, setDraft] = useState(state.date ?? "");
  useEffect(() => setDraft(state.date ?? ""), [state.date]);
  const aiDate = state.reading?.date ?? null;
  const corrected = Boolean(aiDate && state.date && aiDate !== state.date);
  const provenance = !state.reading
    ? null
    : !aiDate
      ? "AI couldn't read a date — type it"
      : corrected
        ? `Corrected by auditee (AI read ${formatIsoDate(aiDate)})`
        : `AI read ${state.reading.rawText || formatIsoDate(aiDate)}`;
  const camera = (kind: "date" | "removal", label: string) =>
    !disabled ? (
      <button
        type="button"
        aria-label={`${label} for row ${rowNumber}`}
        title={label}
        disabled={uploading || reading}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-dashed border-[#9B86D9] px-2 text-[11px] text-[#667085] hover:bg-[#F3EFFB] disabled:opacity-60"
        onClick={() => onAddPhoto(kind)}
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        {kind === "date" && !state.photos.length ? "Scan date" : null}
      </button>
    ) : null;

  return (
    <div className="min-w-[15rem] space-y-1">
      <div className="flex items-center gap-1.5">
        <ExpiryThumbs urls={state.photos} disabled={disabled} onRemove={(url) => onRemovePhoto("date", url)} />
        {camera("date", state.photos.length ? "Retake expiry photo" : "Photograph the expiry date")}
        <input
          type="date"
          aria-label={`Expiry date row ${rowNumber}`}
          disabled={disabled || reading}
          className={cn(CELL_CLASS, "w-36 min-w-[8.5rem]")}
          style={{ borderColor: state.date ? AISLIX_PALETTE.border : AISLIX_PALETTE.purple }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = draft || null;
            if (next !== state.date) onDate(next);
          }}
        />
      </div>
      {reading ? (
        <p className="inline-flex items-center gap-1 text-[11px] text-[#667085]">
          <Loader2 className="size-3 animate-spin" /> AI is reading the date…
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {state.status && state.date ? <ExpiryStatusPill status={state.status} date={state.date} today={today} /> : null}
          {provenance ? <span className="text-[10px] text-[#667085]">{provenance}</span> : null}
          {!state.photos.length && state.date ? <span className="text-[10px] text-[#102A43]">Photo of the date needed</span> : null}
        </div>
      )}
      {state.status === "expired" ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md px-1.5 py-1" style={{ background: AISLIX_PALETTE.pink }}>
          <label className="inline-flex items-center gap-1 text-[11px] font-medium text-[#102A43]">
            <input
              type="checkbox"
              className="size-3.5 accent-[#102A43]"
              disabled={disabled}
              checked={state.removed}
              onChange={(e) => onRemoved(e.target.checked)}
            />
            Removed from shelf
          </label>
          <ExpiryThumbs urls={state.removalPhotos} disabled={disabled} onRemove={(url) => onRemovePhoto("removal", url)} />
          {camera("removal", "Add a photo of the removed product")}
          {state.removalMissing ? (
            <span className="text-[10px] text-[#102A43]">
              {!state.removed ? "Tick when removed" : "Add a removal photo"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UploadPreviewDialog({
  preview,
  applying,
  onCancel,
  onApply,
}: {
  preview: { filename: string; result: UploadValidation } | null;
  applying: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  const result = preview?.result;
  const stats = result
    ? [
        { label: "Cells to fill", value: result.updates.length, background: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
        { label: "Invalid cells (left empty)", value: result.issues.length, background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.secondary },
        { label: "Provided values changed (ignored)", value: result.ignoredProvidedEdits.length, background: ACCENT_TINT.grey, border: AISLIX_PALETTE.border },
        { label: "Unknown columns ignored", value: result.unknownColumns.length, background: ACCENT_TINT.grey, border: AISLIX_PALETTE.border },
      ]
    : [];
  const notes: string[] = [];
  if (result?.matchedBy === "order") notes.push("No Row # column found — rows were matched in order.");
  if (result?.ignoredExtraRows.length) notes.push(`Rows ${result.ignoredExtraRows.join(", ")} are not in this audit and were ignored.`);
  if (result?.newRecordIndexes.length) notes.push(`${result.newRecordIndexes.length} new row(s) will be added.`);
  if (result?.missingColumns.length) notes.push(`Not in the file: ${result.missingColumns.join(", ")}.`);
  if (result?.skippedPhotoColumns.length) notes.push("Photos can't come from a file — add them on screen.");
  if (result?.ignoredProvidedEdits.length) {
    notes.push(
      `Provided values were kept as uploaded by the manager on: ${result.ignoredProvidedEdits
        .slice(0, 6)
        .map((e) => `row ${e.row} (${e.column})`)
        .join(", ")}${result.ignoredProvidedEdits.length > 6 ? "…" : ""}.`,
    );
  }

  return (
    <Dialog open={Boolean(preview)} onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#102A43]">Review uploaded file</DialogTitle>
          <DialogDescription>{preview?.filename}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#102A43]"
              style={{ background: s.background, borderLeft: `3px solid ${s.border}` }}
            >
              <span>{s.label}</span>
              <span className="font-semibold tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
        {result?.issues.length ? (
          <div>
            <p className="text-xs font-semibold text-[#102A43]">Fix these on screen after applying</p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-auto rounded-lg border border-[#D9E2E8] p-2 text-xs text-[#102A43]">
              {result.issues.map((issue, i) => (
                <li key={i}>
                  <span className="font-medium">Row {issue.row}</span> · {issue.column} · {issue.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {notes.length ? (
          <ul className="space-y-1 text-xs text-[#667085]">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={applying || !result?.updates.length && !result?.newRecordIndexes.length}>
            {applying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Apply {result?.updates.length ?? 0} value{result?.updates.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
