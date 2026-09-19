/**
 * Planogram upload — CSV import for AI audit setup.
 */

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  downloadMasterErrorReport,
  parseAndValidateMasterSetup,
  type MasterImportResult,
  type MasterValidationIssue,
} from "@/lib/master-shelf-setup";
import {
  downloadPlanogramCsvTemplateFile,
  missingCsvColumn,
  parsePlanogramCsv,
  type PlanogramRow,
} from "@/lib/planogram";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { buildScanContextFromPlanogramRows, type ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

export type MasterSetupPhase = "upload" | "preview" | "ready";

export type MasterShelfSetupPanelProps = {
  role: AuditRoleTab;
  disabled?: boolean;
  onContextReady: (ctx: ScanContextState) => void;
  onStartAudit: () => void;
  onReviewSetup: () => void;
  onReplace: () => void;
  canStartAudit: boolean;
  phase: MasterSetupPhase;
  onPhaseChange: (phase: MasterSetupPhase) => void;
  importResult: MasterImportResult | null;
  onImportResult: (result: MasterImportResult | null) => void;
  /** When set, a successful upload stays on the upload screen with inline confirmation. */
  inlineSuccess?: boolean;
};

function IssueList({ issues }: { issues: MasterValidationIssue[] }) {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <div className="space-y-2 text-xs">
      {critical.slice(0, 5).map((issue, idx) => (
        <p key={`c-${idx}`} className="flex gap-2 text-destructive">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          {issue.row ? `Row ${issue.row}: ` : ""}
          {issue.message}
        </p>
      ))}
      {warnings.slice(0, 3).map((issue, idx) => (
        <p key={`w-${idx}`} className="flex gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {issue.row ? `Row ${issue.row}: ` : ""}
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function buildPlanogramImportResult(
  role: AuditRoleTab,
  rows: PlanogramRow[],
  parseErrors: string[],
  errorCount: number,
): MasterImportResult {
  const context = buildScanContextFromPlanogramRows(role, rows);
  const locations = new Set(rows.map((row) => row.location).filter(Boolean));
  const skuCount = new Set(rows.map((row) => row.sku || row.product_name)).size;
  const priceCount = rows.filter((row) => row.mrp_inr != null && Number.isFinite(Number(row.mrp_inr))).length;
  const categoryLabel = [context.planogramMeta?.category, context.planogramMeta?.sub_category]
    .filter(Boolean)
    .join(" · ");

  return {
    validation: {
      status: errorCount > 0 ? "warning" : "ready",
      issues: parseErrors.slice(0, 10).map((message) => ({
        severity: "warning" as const,
        message,
      })),
      counts: {
        products: skuCount,
        shelves: locations.size,
        positions: rows.length,
        requiredProducts: 0,
        prices: priceCount,
        promotions: 0,
        targetsReady: 0,
        targetsTotal: 0,
      },
      preview: {
        role,
        store: rows[0]?.location ?? "—",
        planogram: categoryLabel || `${rows.length} products`,
        products: skuCount,
        shelves: locations.size,
        positions: rows.length,
        requiredProducts: 0,
        prices: priceCount,
        promotions: 0,
        targets: "—",
      },
      dataRows: [],
    },
    context,
  };
}

export function MasterShelfSetupPanel({
  role,
  disabled = false,
  onContextReady,
  onStartAudit,
  onReviewSetup,
  onReplace,
  canStartAudit,
  phase,
  onPhaseChange,
  importResult,
  onImportResult,
  inlineSuccess = false,
}: MasterShelfSetupPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handlePlanogramCsv(file: File) {
    const parsed = await parsePlanogramCsv(file);
    const validRows = parsed.rows
      .filter((row) => row.valid && row.data)
      .map((row) => row.data as PlanogramRow);

    if (!validRows.length) {
      const rowErrors = parsed.rows
        .flatMap((row) => row.errors ?? [])
        .slice(0, 3);
      const details = parsed.errors.length ? parsed.errors : rowErrors;
      throw new Error(
        details.length
          ? details.join(" ")
          : "No valid rows in CSV. Download the template, fill in your shelf details, and try again.",
      );
    }

    const result = buildPlanogramImportResult(role, validRows, parsed.errors, parsed.error_count);
    onImportResult(result);
    if (result.context) {
      onContextReady(result.context);
      if (inlineSuccess) return;
      onPhaseChange("ready");
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const csvFile = new File([text], file.name, { type: file.type || "text/csv" });
      if (missingCsvColumn(text) === null) {
        await handlePlanogramCsv(csvFile);
        return;
      }

      const result = await parseAndValidateMasterSetup(role, csvFile);
      onImportResult(result);
      if (result.validation.status === "critical") {
        onPhaseChange("preview");
        return;
      }
      if (result.context) {
        onContextReady(result.context);
        if (inlineSuccess) return;
        onPhaseChange("ready");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read the file.");
    } finally {
      setUploading(false);
    }
  }

  if (phase === "ready" && importResult?.context) {
    const { counts, preview } = importResult.validation;
    const warnings = importResult.validation.issues.filter((i) => i.severity === "warning").length;
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/50 to-background shadow-sm">
        <div className="border-b border-brand/20 bg-brand/5 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
              <Check className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">Your Planogram Is Ready</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Shelf products and layout have been imported from your CSV.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryStat label="Products" value={counts.products} ok />
            <SummaryStat label="Shelf positions" value={counts.positions} ok />
            {counts.prices > 0 ? <SummaryStat label="Prices" value={counts.prices} ok /> : null}
            {counts.shelves > 0 ? <SummaryStat label="Locations" value={counts.shelves} ok /> : null}
          </div>
          {warnings > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {warnings} warning{warnings === 1 ? "" : "s"} · Audit can continue
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{preview.planogram}</span>
            {preview.store !== "—" ? (
              <>
                {" · "}
                {preview.store}
              </>
            ) : null}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" className="bg-brand" disabled={!canStartAudit} onClick={onStartAudit}>
              Start AI Audit
              <ArrowRight className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onReviewSetup}>
              Review Setup
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onReplace}>
              Replace Planogram
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preview" && importResult) {
    const { validation } = importResult;

    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <p className="text-base font-semibold text-foreground">Planogram Needs Corrections</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fix the issues below, then upload your CSV again.
          </p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {validation.issues.length ? <IssueList issues={validation.issues} /> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadMasterErrorReport(validation.issues, role)}
            >
              <Download className="size-4" /> Download Error Report
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              Upload Again
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReplace}>
              Cancel
            </Button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-brand/25 bg-gradient-to-br from-brand-soft/40 to-background shadow-sm">
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Upload your planogram
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Upload your existing planogram or shelf setup.
          </p>
          <Button
            type="button"
            className="mt-4 bg-brand"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              "Validating…"
            ) : (
              <>
                <Upload className="size-4" /> Upload Planogram
              </>
            )}
          </Button>
          {uploadError ? <p className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
          {inlineSuccess &&
          importResult?.context &&
          importResult.validation.status !== "critical" ? (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Check className="size-4 shrink-0 text-brand" />
                {importResult.validation.counts.products} products imported — planogram ready
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-muted-foreground"
                onClick={onReplace}
              >
                Upload a different file
              </Button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/70 pt-5">
          <p className="text-sm font-medium text-foreground">Don&apos;t have one?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Download our CSV template, fill in your shelf details, and upload it.
          </p>
          <Button
            type="button"
            variant="outline"
            className="relative z-10 mt-4"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setUploadError(null);
              downloadPlanogramCsvTemplateFile();
            }}
          >
            <Download className="size-4" /> Download CSV Template
          </Button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SummaryStat({ label, value, ok }: { label: string; value: string | number; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/80 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", ok !== false ? "text-foreground" : "text-muted-foreground")}>
        {value}
      </span>
    </div>
  );
}
