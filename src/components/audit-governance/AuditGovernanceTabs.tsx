import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/States";
import { ActivityTimeline } from "@/components/audit-governance/ActivityTimeline";
import {
  ActionStatusBadge,
  FindingSeverityBadge,
  FindingStatusBadge,
  LockedRecordBadge,
  SourceBadge,
} from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { fetchAuditActivity } from "@/lib/audit-activity";
import { loadDigitalAuditSession } from "@/lib/digital-audit";
import { fetchFindings, findingTypeLabel, rcaLabel } from "@/lib/findings";
import { fetchLifecycleActions } from "@/lib/corrective-action-lifecycle";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  scanId: string;
  scanData?: ScanResult;
  locked?: boolean;
  auditOrigin?: "digital" | "ai" | "ai_assisted";
};

export function AuditGovernanceTabs({ scanId, scanData, locked: lockedProp, auditOrigin: originProp }: Props) {
  const findingsQuery = useQuery({
    queryKey: ["scan-findings", scanId],
    queryFn: () => fetchFindings({ scanId }),
  });
  const actionsQuery = useQuery({
    queryKey: ["scan-actions", scanId],
    queryFn: () => fetchLifecycleActions({ scanId }),
  });
  const activityQuery = useQuery({
    queryKey: ["scan-activity", scanId],
    queryFn: () => fetchAuditActivity(scanId),
  });
  const digitalQuery = useQuery({
    queryKey: ["digital-audit-session", scanId],
    queryFn: () => loadDigitalAuditSession(scanId),
    retry: false,
  });

  const findings = findingsQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const events = activityQuery.data ?? [];
  const digital = digitalQuery.data;
  const lines = digital?.lines ?? [];
  const evidence = digital?.evidence ?? [];

  const expectedQty = lines.reduce((s, l) => s + (l.expected_qty ?? 0), 0);
  const actualQty = lines.reduce((s, l) => s + (l.actual_qty ?? 0), 0);
  const variance = actualQty - expectedQty;
  const variancePct = expectedQty ? ((variance / expectedQty) * 100).toFixed(1) : "—";
  const valueVariance = lines.reduce(
    (s, l) => s + Math.abs((l.variance_value_inr ?? 0)),
    0,
  );
  const oosCount = lines.filter((l) => l.actual_qty === 0 && (l.expected_qty ?? 0) > 0).length;
  const openActions = actions.filter((a) => !["resolved", "closed"].includes(a.status));
  const compliance = scanData?.summary?.shelf_compliance;
  const primaryImage =
    scanData?.original_image_url ?? scanData?.annotated_image_url ?? null;

  const loading = findingsQuery.isLoading || actionsQuery.isLoading;
  const auditOrigin =
    originProp ?? (lines.length > 0 ? "digital" : findings[0]?.audit_origin ?? "ai");
  const locked =
    lockedProp ??
    ["submitted", "approved", "pending_review"].includes(digital?.submission_status ?? "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge mode={auditOrigin} />
        {locked ? <LockedRecordBadge /> : null}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-muted/50 p-1">
          {[
            ["overview", "Overview"],
            ["items", "Audit items"],
            ["evidence", "Evidence"],
            ["findings", `Findings (${findings.length})`],
            ["actions", `Corrective actions (${actions.length})`],
            ["activity", "Activity"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="rounded-lg text-xs sm:text-sm">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {loading ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Expected qty" value={lines.length ? String(expectedQty) : "—"} />
              <KpiCard label="Actual qty" value={lines.length ? String(actualQty) : "—"} />
              <KpiCard label="Unit variance" value={lines.length ? String(variance) : "—"} />
              <KpiCard label="Variance %" value={lines.length ? `${variancePct}%` : "—"} />
              <KpiCard
                label="Potential inventory value variance"
                value={valueVariance ? `₹${Math.round(valueVariance).toLocaleString("en-IN")}` : "—"}
                hint="Not confirmed financial loss"
              />
              <KpiCard label="OOS count" value={lines.length ? String(oosCount) : "—"} />
              <KpiCard
                label="Planogram compliance"
                value={compliance != null ? `${Math.round(compliance)}%` : "—"}
              />
              <KpiCard label="Open corrective actions" value={String(openActions.length)} />
              <KpiCard label="Evidence count" value={String(evidence.length + (primaryImage ? 1 : 0))} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          {!lines.length ? (
            <p className="text-sm text-muted-foreground">
              SKU-level audit lines appear for Digital and AI-Assisted audits with quantity capture.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["SKU", "Product", "Expected", "Actual", "Variance", "Variance %", "Value impact", "RCA"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const v = (line.actual_qty ?? 0) - (line.expected_qty ?? 0);
                    const vp = line.expected_qty
                      ? `${(((line.actual_qty ?? 0) - line.expected_qty) / line.expected_qty * 100).toFixed(1)}%`
                      : "—";
                    return (
                      <tr key={line.id} className="border-t border-border/70">
                        <td className="px-3 py-2 font-mono text-xs">{line.sku || "—"}</td>
                        <td className="px-3 py-2">{line.product_name || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{line.expected_qty ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{line.actual_qty ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{v}</td>
                        <td className="px-3 py-2 tabular-nums">{vp}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {line.variance_value_inr != null
                            ? `₹${Math.round(Math.abs(line.variance_value_inr)).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">{rcaLabel(line.rca_code)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          {!evidence.length && !primaryImage ? (
            <p className="text-sm text-muted-foreground">No shelf evidence captured for this audit.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {primaryImage ? (
                <figure className="overflow-hidden rounded-xl border border-border">
                  <img src={primaryImage} alt="Shelf audit" className="aspect-[4/3] w-full object-cover" />
                  <figcaption className="px-3 py-2 text-xs text-muted-foreground">Primary audit image</figcaption>
                </figure>
              ) : null}
              {evidence.map((ev) => (
                <figure key={ev.id} className="overflow-hidden rounded-xl border border-border">
                  {ev.signed_url ? (
                    <img src={ev.signed_url} alt="Audit evidence" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">
                      Evidence
                    </div>
                  )}
                  <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                    {ev.bin_key} · {new Date(ev.captured_at).toLocaleString()}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          {!findings.length ? (
            <p className="text-sm text-muted-foreground">
              Findings are created automatically from variance and planogram gaps after submission.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Type", "Severity", "SKU", "Variance", "RCA", "Status", "Assigned", "Due"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {findings.map((row) => (
                    <tr key={row.id} className="border-t border-border/70">
                      <td className="px-3 py-2">
                        <Link to="/findings/$findingId" params={{ findingId: row.id }} className="hover:underline">
                          {findingTypeLabel(row.finding_type)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><FindingSeverityBadge severity={row.severity} /></td>
                      <td className="px-3 py-2">{row.product_name || row.sku || "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{row.variance_units ?? "—"}</td>
                      <td className="px-3 py-2">{rcaLabel(row.rca_code)}</td>
                      <td className="px-3 py-2"><FindingStatusBadge status={row.status} /></td>
                      <td className="px-3 py-2">{row.assigned_name || "—"}</td>
                      <td className="px-3 py-2">
                        {row.due_at ? (
                          <SLAIndicator dueAt={row.due_at} status={row.status} />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          {!actions.length ? (
            <p className="text-sm text-muted-foreground">No corrective actions assigned from this audit yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Action", "Priority", "Owner", "Due", "SLA", "Status"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actions.map((row) => (
                    <tr key={row.id} className="border-t border-border/70">
                      <td className="px-3 py-2">
                        <Link
                          to="/corrective-actions/$actionId"
                          params={{ actionId: row.id }}
                          className="font-medium hover:underline"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><FindingSeverityBadge severity={row.priority} /></td>
                      <td className="px-3 py-2">{row.assigned_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.due_at ? new Date(row.due_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <SLAIndicator dueAt={row.due_at} status={row.status} />
                      </td>
                      <td className="px-3 py-2"><ActionStatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            {activityQuery.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <ActivityTimeline events={events} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
