import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  astraAnalysisFromScanResult,
  type NormalizedAstraAnalysis,
} from "@/lib/ai-audit/astra-response";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

type Props = {
  result: ScanResult;
  className?: string;
};

function statusBadge(status: unknown) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized.includes("COMPLIANT") && !normalized.includes("NON") && !normalized.includes("PARTIAL")) {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">
        {status}
      </Badge>
    );
  }
  if (normalized.includes("NOT_FOUND") || normalized.includes("NON_COMPLIANT")) {
    return (
      <Badge variant="outline" className="border-rose-500/40 text-rose-700">
        {status}
      </Badge>
    );
  }
  if (normalized.includes("PARTIAL") || normalized.includes("BELOW") || normalized.includes("ABOVE")) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700">
        {status}
      </Badge>
    );
  }
  return <Badge variant="secondary">{status || "—"}</Badge>;
}

function ImageQualityBanner({ analysis }: { analysis: NormalizedAstraAnalysis }) {
  if (analysis.mode === "shelf_only" || !analysis.image_quality) return null;
  const { status, reason } = analysis.image_quality;
  const Icon =
    status === "GOOD" ? CheckCircle2 : status === "LIMITED" ? HelpCircle : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        status === "GOOD" && "border-emerald-500/30 bg-emerald-500/5",
        status === "LIMITED" && "border-amber-500/30 bg-amber-500/5",
        status === "POOR" && "border-rose-500/30 bg-rose-500/5",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Image quality: {status}</p>
        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </div>
    </div>
  );
}

function SummaryChips({ analysis }: { analysis: NormalizedAstraAnalysis }) {
  if (analysis.mode === "planogram") {
    const s = analysis.summary;
    const chips = [
      ["Rows", s.total_planogram_rows],
      ["Matched", s.matched_rows],
      ["Not found", s.not_found_rows],
      ["Non-compliant", s.non_compliant_rows],
      ["Unverifiable", s.not_verifiable_rows],
      ["Compliance", s.overall_compliance_percent != null ? `${s.overall_compliance_percent}%` : null],
    ].filter(([, value]) => value != null);
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map(([label, value]) => (
          <Badge key={String(label)} variant="secondary">
            {label}: {value}
          </Badge>
        ))}
      </div>
    );
  }
  if (analysis.mode === "expected_products") {
    const s = analysis.summary;
    const chips = [
      ["Products", s.total_products],
      ["Matched", s.matched_products],
      ["Not found", s.not_found_products],
      ["Unverifiable", s.not_verifiable_products],
      ["Below facings", s.products_below_expected_facings],
      ["Below units", s.products_below_expected_units],
    ].filter(([, value]) => value != null);
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map(([label, value]) => (
          <Badge key={String(label)} variant="secondary">
            {label}: {value}
          </Badge>
        ))}
      </div>
    );
  }
  return null;
}

export function AstraComparisonResults({ result, className }: Props) {
  const analysis = astraAnalysisFromScanResult(result);
  if (analysis.mode === "shelf_only") return null;

  return (
    <div className={cn("space-y-3 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/40 p-4", className)}>
      <div>
        <p className="text-sm font-semibold text-[var(--aislix-primary)]">Astra comparison</p>
        <p className="text-xs text-muted-foreground">
          {analysis.mode === "planogram"
            ? "Planogram vs shelf row-by-row analysis"
            : "Expected products vs shelf analysis"}
          {analysis.operating_model ? ` · ${analysis.operating_model}` : ""}
        </p>
      </div>
      <ImageQualityBanner analysis={analysis} />
      <SummaryChips analysis={analysis} />

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            {analysis.mode === "planogram" ? (
              <tr>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Expected facings</th>
                <th className="px-2 py-2">Actual facings</th>
                <th className="px-2 py-2">Expected units</th>
                <th className="px-2 py-2">Actual units</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Evidence</th>
              </tr>
            ) : (
              <tr>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Expected facings</th>
                <th className="px-2 py-2">Actual facings</th>
                <th className="px-2 py-2">Facing status</th>
                <th className="px-2 py-2">Expected units</th>
                <th className="px-2 py-2">Actual units</th>
                <th className="px-2 py-2">Unit status</th>
                <th className="px-2 py-2">Overall</th>
                <th className="px-2 py-2">Confidence</th>
                <th className="px-2 py-2">Evidence</th>
              </tr>
            )}
          </thead>
          <tbody>
            {analysis.mode === "planogram"
              ? (analysis.rows ?? []).map((row, index) => (
                  <tr key={`planogram-row-${index}`} className="border-t border-border/60 align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium">{row.brand} · {row.product_name}</p>
                      {row.variant ? <p className="text-muted-foreground">{row.variant}</p> : null}
                      {row.location ? <p className="text-muted-foreground">{row.location}</p> : null}
                    </td>
                    <td className="px-2 py-2">{row.expected_facings}</td>
                    <td className="px-2 py-2">{row.actual_facings}</td>
                    <td className="px-2 py-2">{row.expected_shelf_units}</td>
                    <td className="px-2 py-2">{row.actual_visible_units}</td>
                    <td className="px-2 py-2">{statusBadge(row.overall_row_status)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{row.evidence_note || "—"}</td>
                  </tr>
                ))
              : (analysis.products ?? []).map((row, index) => (
                  <tr key={`expected-row-${index}`} className="border-t border-border/60 align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium">{row.brand} · {row.product_name}</p>
                      {row.variant ? <p className="text-muted-foreground">{row.variant}</p> : null}
                      {row.category || row.sub_category ? (
                        <p className="text-muted-foreground">
                          {[row.category, row.sub_category].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {row.location ? <p className="text-muted-foreground">{row.location}</p> : null}
                    </td>
                    <td className="px-2 py-2">{row.expected_facings}</td>
                    <td className="px-2 py-2">{row.actual_facings}</td>
                    <td className="px-2 py-2">{statusBadge(row.facing_status)}</td>
                    <td className="px-2 py-2">{row.expected_shelf_units}</td>
                    <td className="px-2 py-2">{row.actual_visible_units}</td>
                    <td className="px-2 py-2">{statusBadge(row.shelf_unit_status)}</td>
                    <td className="px-2 py-2">{statusBadge(row.overall_status)}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.confidence
                        ? `${Math.round(row.confidence <= 1 ? row.confidence * 100 : row.confidence)}%`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.evidence_note || "—"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
