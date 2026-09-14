import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import { useGlobalFilters } from "@/lib/global-filters";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { FindingSeverityBadge } from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import {
  AUDIT_ORIGIN_LABEL,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  FINDING_TYPES,
  fetchFindings,
  findingTypeLabel,
  findingsKpis,
  rcaLabel,
} from "@/lib/findings";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings — Aislix" },
      {
        name: "description",
        content: "Retail findings from Digital, AI and AI-Assisted audits — variance, RCA and value at risk.",
      },
    ],
  }),
  component: FindingsPage,
});

function FindingsPage() {
  return (
    <AppShell
      title="Findings"
      description="What went wrong on the shelf — inventory variance, planogram gaps and RCA, linked to corrective actions."
    >
      <FindingsMain />
    </AppShell>
  );
}

function FindingsMain() {
  const { filters } = useGlobalFilters();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [rca, setRca] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sku, setSku] = useState("");

  const query = useQuery({
    queryKey: ["findings", filters.storeId, filters.category, severity, status, type, rca, overdueOnly, sku],
    queryFn: () =>
      fetchFindings({
        filters,
        severity,
        status,
        findingType: type,
        rca,
        overdue: overdueOnly,
        sku: sku.trim() || undefined,
      }),
    retry: false,
  });

  const rows = query.data ?? [];
  const kpis = useMemo(() => findingsKpis(rows), [rows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total findings" value={String(kpis.total)} />
        <KpiCard label="Open" value={String(kpis.open)} />
        <KpiCard label="Critical" value={String(kpis.critical)} />
        <KpiCard label="High" value={String(rows.filter((r) => r.severity === "high").length)} />
        <KpiCard label="Overdue" value={String(kpis.overdue)} />
        <KpiCard label="Pending verification" value={String(kpis.pending_verification)} />
        <KpiCard label="Resolved" value={String(kpis.resolved)} />
        <KpiCard label="Closed" value={String(kpis.closed)} />
        <KpiCard
          label="Potential inventory value variance"
          value={`₹${Math.round(kpis.value_at_risk).toLocaleString("en-IN")}`}
          hint="Not confirmed financial loss"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU or product"
          className="h-9 w-40"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FINDING_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {FINDING_SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {FINDING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rca} onValueChange={setRca}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="RCA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RCA</SelectItem>
            {RCA_OPTIONS.map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={`h-9 rounded-md border px-3 text-xs ${overdueOnly ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}
        >
          Overdue
        </button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.error ? (
        <ErrorState title="Couldn't load findings" description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon={<AlertTriangle className="size-5" />}
          title="No findings yet"
          description="Findings are created automatically from audit variance and planogram gaps after an audit is submitted."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[72rem] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Date", "Store", "SKU", "Type", "Severity", "Expected", "Actual", "Variance", "₹ at risk", "RCA", "Due", "Status", "Origin", "Audit"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/70">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{row.store_name}</td>
                    <td className="px-3 py-2">
                      <Link to="/findings/$findingId" params={{ findingId: row.id }} className="font-medium hover:underline">
                        {row.product_name || row.sku || "SKU"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{findingTypeLabel(row.finding_type)}</td>
                    <td className="px-3 py-2">
                      <FindingSeverityBadge severity={row.severity} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.expected_value ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.actual_value ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.variance_units ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.variance_value_inr != null ? `₹${Math.round(Math.abs(row.variance_value_inr)).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-3 py-2">{rcaLabel(row.rca_code)}</td>
                    <td className="px-3 py-2">
                      {row.due_at ? (
                        <SLAIndicator dueAt={row.due_at} status={row.status} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">{AUDIT_ORIGIN_LABEL[row.audit_origin]}</td>
                    <td className="px-3 py-2">
                      {row.scan_id ? (
                        <Link to="/results" search={{ scan: row.scan_id }} className="text-brand hover:underline">
                          Open
                        </Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
