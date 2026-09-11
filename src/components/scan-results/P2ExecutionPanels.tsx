/**
 * P2 — audit scope, price compliance, multi-photo summary panels.
 */

import { ChevronDown, Images, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatMetricValue, type MetricValue } from "@/lib/retail-intelligence";
import { formatInr } from "@/lib/pricing";
import {
  adjacentFindingsFromResult,
  auditScopeFromResult,
  formatScopeReason,
  multiPhotoFromResult,
  pricingFromResult,
} from "@/lib/p2-execution";
import type { ScanResult } from "@/lib/scan-results";

function metricDisplay(m?: MetricValue | null, suffix = "%"): string {
  if (!m) return "Not configured";
  return formatMetricValue(m, (n) => `${Math.round(n)}${suffix}`);
}

export function AuditScopePanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const scope = auditScopeFromResult(data);
  const findings = adjacentFindingsFromResult(data);
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!scope && !findings.length) return null;

  const audited =
    scope?.audited_sub_category ||
    data?.scan_sub_category ||
    data?.scan_category ||
    "this bay";

  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <MapPin className="size-3.5" /> Bay audit scope
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full">
          Auditing: {audited}
        </Badge>
        {scope?.in_scope_facings != null ? (
          <Badge variant="outline" className="rounded-full tabular-nums">
            In-scope facings: {scope.in_scope_facings}
          </Badge>
        ) : null}
        {(scope?.adjacent_bay_facings ?? 0) > 0 ? (
          <Badge variant="outline" className="rounded-full tabular-nums">
            Adjacent: {scope!.adjacent_bay_facings} (informational)
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Placement compliance counts only in-scope facings in the audited bay. Neighboring categories
        at the frame edge are excluded from placement KPIs.
      </p>
      {findings.length ? (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
            Adjacent category findings ({findings.length})
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {findings.slice(0, 12).map((row, idx) => (
              <div
                key={`${row.brand}-${row.product_name}-${idx}`}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {[row.brand, row.product_name].filter(Boolean).join(" · ") || "Unknown product"}
                </p>
                <p className="text-xs text-muted-foreground">{formatScopeReason(row.reason)}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

export function PricingCompliancePanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const pricing = pricingFromResult(data);
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!pricing) return null;

  const state = pricing.state ?? "not_configured";
  if (state === "not_configured") {
    return (
      <div className="card-surface p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Tag className="size-3.5" /> Price tag compliance
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Configure MRP on planogram rows to enable shelf price checks.
        </p>
      </div>
    );
  }

  const lines = pricing.lines ?? [];
  const compliance = pricing.compliance_percent;

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Tag className="size-3.5" /> Price tag compliance
        </p>
        {state === "available" && compliance ? (
          <p className="text-2xl font-semibold tabular-nums">{metricDisplay(compliance)}</p>
        ) : (
          <Badge variant="secondary" className="rounded-full capitalize">
            {state.replace(/_/g, " ")}
          </Badge>
        )}
      </div>
      {pricing.methodology ? (
        <p className="mt-2 text-xs text-muted-foreground">{pricing.methodology}</p>
      ) : null}
      {lines.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Detected</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, 10).map((line, idx) => {
                const bad = line.status === "non_compliant";
                return (
                  <tr key={`${line.brand}-${line.product}-${idx}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      {[line.brand, line.product].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.expected_price_inr != null ? formatInr(line.expected_price_inr) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.detected_price_inr != null ? formatInr(line.detected_price_inr) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${bad ? "text-destructive font-medium" : ""}`}
                    >
                      {line.variance_inr != null ? formatInr(Math.abs(line.variance_inr)) : "—"}
                    </td>
                    <td className="px-3 py-2 capitalize text-xs text-muted-foreground">
                      {line.status?.replace(/_/g, " ") ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : state === "not_observable" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Price tags were not readable in this image.
        </p>
      ) : null}
    </div>
  );
}

export function MultiPhotoSummaryPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const multi = multiPhotoFromResult(data);
  if (loading) return null;
  if (!multi?.photo_count || multi.photo_count <= 1) return null;

  return (
    <div className="card-surface flex flex-wrap items-center gap-3 p-4 sm:p-5">
      <Images className="size-4 text-brand" />
      <p className="text-sm">
        <span className="font-medium">Multi-photo bay audit:</span> merged {multi.photo_count}{" "}
        photos
        {multi.merged_facings != null ? (
          <>
            {" "}
            · <span className="tabular-nums">{multi.merged_facings}</span> facings after dedupe
          </>
        ) : null}
      </p>
    </div>
  );
}
