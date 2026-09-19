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
  return <Badge variant="secondary">{status || "—"}</Badge>;
}

function ImageQualityBanner({ analysis }: { analysis: NormalizedAstraAnalysis }) {
  if (analysis.mode !== "planogram" || !analysis.image_quality) return null;
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

export function AstraComparisonResults({ result, className }: Props) {
  const analysis = astraAnalysisFromScanResult(result);
  if (analysis.mode !== "planogram") return null;
  const s = analysis.summary;

  return (
    <div className={cn("space-y-3 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/40 p-4", className)}>
      <div>
        <p className="text-sm font-semibold text-[var(--aislix-primary)]">Astra planogram comparison</p>
        <p className="text-xs text-muted-foreground">
          {analysis.operating_model ? `Operating model · ${analysis.operating_model}` : ""}
        </p>
      </div>
      <ImageQualityBanner analysis={analysis} />
      <div className="flex flex-wrap gap-2">
        {[
          ["Rows", s.total_planogram_rows],
          ["Matched", s.products_matched],
          ["Not found", s.products_not_found],
          ["Non-compliant", s.non_compliant_products],
          ["Compliance", s.overall_planogram_compliance_percent != null ? `${s.overall_planogram_compliance_percent}%` : null],
        ]
          .filter(([, v]) => v != null)
          .map(([label, value]) => (
            <Badge key={String(label)} variant="secondary">
              {label}: {value}
            </Badge>
          ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Exp facings</th>
              <th className="px-2 py-2">Act facings</th>
              <th className="px-2 py-2">Exp units</th>
              <th className="px-2 py-2">Act units</th>
              <th className="px-2 py-2">Placement</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {analysis.products.map((row, index) => (
              <tr key={`planogram-row-${index}`} className="border-t border-border/60 align-top">
                <td className="px-2 py-2">
                  <p className="font-medium">{row.brand} · {row.product_name}</p>
                  {row.variant ? <p className="text-muted-foreground">{row.variant}</p> : null}
                </td>
                <td className="px-2 py-2">{row.expected_facings}</td>
                <td className="px-2 py-2">{row.actual_facings}</td>
                <td className="px-2 py-2">{row.expected_shelf_units}</td>
                <td className="px-2 py-2">{row.actual_visible_units}</td>
                <td className="px-2 py-2">{statusBadge(row.placement_status)}</td>
                <td className="px-2 py-2">{statusBadge(row.overall_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
