/**
 * Fast professional setup — upload role-specific Master Shelf Setup CSV.
 */

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MASTER_TEMPLATE_FILENAMES } from "@/lib/master-shelf-setup-config";
import {
  downloadMasterErrorReport,
  downloadMasterFieldGuide,
  downloadMasterTemplate,
  parseAndValidateMasterSetup,
  type MasterImportResult,
  type MasterValidationIssue,
} from "@/lib/master-shelf-setup";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";
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
}: MasterShelfSetupPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await parseAndValidateMasterSetup(role, file);
      onImportResult(result);
      if (result.validation.status === "critical") {
        onPhaseChange("preview");
        return;
      }
      if (result.context) {
        onContextReady(result.context);
        onPhaseChange("preview");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read the file.");
    } finally {
      setUploading(false);
    }
  }

  function commitImport() {
    if (!importResult?.context || importResult.validation.status === "critical") return;
    onContextReady(importResult.context);
    onPhaseChange("ready");
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
              <p className="text-base font-semibold text-foreground">Your Master Setup Is Ready</p>
              <p className="mt-1 text-sm text-muted-foreground">
                All required audit configuration has been imported and validated.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryStat label="Products" value={counts.products} ok />
            <SummaryStat label="Shelf positions" value={counts.positions} ok />
            <SummaryStat label="Required products" value={counts.requiredProducts} ok />
            <SummaryStat label="Prices" value={counts.prices} ok />
            <SummaryStat label="Promotions" value={counts.promotions} ok />
            <SummaryStat
              label="Audit targets"
              value={`${counts.targetsReady}/${counts.targetsTotal}`}
              ok={counts.targetsReady > 0}
            />
          </div>
          {warnings > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {warnings} warning{warnings === 1 ? "" : "s"} · Audit can continue
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{preview.planogram}</span>
            {" · "}
            {preview.store}
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
              Replace Master Setup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preview" && importResult) {
    const { validation } = importResult;
    const critical = validation.issues.filter((i) => i.severity === "critical").length;
    const warnings = validation.issues.filter((i) => i.severity === "warning").length;
    const canContinue = validation.status !== "critical";

    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <p className="text-base font-semibold text-foreground">
            {canContinue ? "Master Setup Imported" : "Master Setup Needs Corrections"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Master Setup Preview</p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <StatusPill ok label={`${validation.counts.products} products imported`} />
            <StatusPill ok label={`${validation.counts.positions} shelf positions mapped`} />
            {warnings > 0 ? (
              <StatusPill warn label={`${warnings} warning${warnings === 1 ? "" : "s"}`} />
            ) : (
              <StatusPill ok label="0 warnings" />
            )}
            <StatusPill ok={critical === 0} warn={critical > 0} label={`${critical} critical error${critical === 1 ? "" : "s"}`} />
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-2">
              <PreviewRow label="Role" value={validation.preview.role} />
              <PreviewRow label="Store" value={validation.preview.store} />
              <PreviewRow label="Planogram" value={validation.preview.planogram} />
              <PreviewRow label="Targets" value={validation.preview.targets} />
            </div>
            <button
              type="button"
              className="mt-3 flex items-center gap-1 text-xs font-medium text-brand"
              onClick={() => setShowDetails((v) => !v)}
            >
              View details
              {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showDetails ? (
              <div className="mt-2 grid gap-1 border-t border-border/60 pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Products: {validation.preview.products}</span>
                <span>Shelves: {validation.preview.shelves}</span>
                <span>Positions: {validation.preview.positions}</span>
                <span>Required: {validation.preview.requiredProducts}</span>
                <span>Prices: {validation.preview.prices}</span>
                <span>Promotions: {validation.preview.promotions}</span>
              </div>
            ) : null}
          </div>

          {validation.issues.length ? <IssueList issues={validation.issues} /> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canContinue ? (
              <Button type="button" className="bg-brand" onClick={commitImport}>
                Confirm Master Setup
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadMasterErrorReport(validation.issues, role)}
              >
                <Download className="size-4" /> Download Error Report
              </Button>
            )}
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
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Fast Setup</p>
        <h4 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          Upload Your Master Shelf Setup
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Already have your planogram or shelf master file? Upload it once and Aislix will use it to
          configure your audit automatically.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Define your shelf once — products, positions, facings, requirements, prices, promotions and
          targets — and Aislix configures the audit for you.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="bg-brand"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              "Validating…"
            ) : (
              <>
                <Upload className="size-4" /> Upload Master Setup
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadMasterTemplate(role)}
          >
            <Download className="size-4" /> Download CSV Template
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => downloadMasterFieldGuide(role)}
          >
            <Download className="size-4" /> Field Guide
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0" />
          Download {MASTER_TEMPLATE_FILENAMES[role]} — header row plus one example row (row_type=example).
          Replace the example with your data (row_type=data). All KPI target columns for your role are included.
        </p>
        {uploadError ? <p className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function StatusPill({
  label,
  ok,
  warn,
}: {
  label: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full text-[11px] font-normal",
        warn && "border-amber-500/40 text-amber-800 dark:text-amber-300",
        ok && !warn && "border-emerald-500/40 text-emerald-800 dark:text-emerald-300",
      )}
    >
      {ok && !warn ? "✓ " : warn ? "⚠ " : "✕ "}
      {label}
    </Badge>
  );
}
