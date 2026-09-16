import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { KpiInfoPopover } from "@/components/control-tower/KpiInfoPopover";
import type { ControlTowerKpi } from "@/lib/control-tower";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, ErrorState } from "@/components/States";
import {
  fetchAuditTemplate,
  templateToDefinition,
} from "@/lib/audit-templates";
import { KPI_CATALOG, exportKpiCsv, resolveKpisForTemplate } from "@/lib/kpi-engine";
import type { KpiDefinition } from "@/lib/kpi-engine/definitions";

export const Route = createFileRoute("/audit-templates/$templateId/intelligence")({
  head: () => ({ meta: [{ title: "Template Intelligence — Aislix" }] }),
  component: TemplateIntelligencePage,
});

function demoValue(kpi: KpiDefinition): string {
  if (kpi.format === "percent") return `${72 + (kpi.id.length % 20)}%`;
  if (kpi.format === "currency_inr") return "₹12,400";
  return String(8 + (kpi.id.length % 15));
}

function toControlTowerKpi(kpi: KpiDefinition): ControlTowerKpi {
  return {
    id: kpi.id,
    label: kpi.name,
    value: demoValue(kpi),
    detail: kpi.description,
    tone: "brand",
    available: true,
    source: kpi.dataSource,
    trend: [62, 68, 71, 74, 73, 78, 81],
  };
}

function TemplateIntelligencePage() {
  const { templateId } = Route.useParams();
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const templateQuery = useQuery({
    queryKey: ["audit-template", templateId],
    queryFn: () => fetchAuditTemplate(templateId),
  });

  const catalog = useMemo(() => {
    const tpl = templateQuery.data;
    if (!tpl) return { universal: [], auditSpecific: [] as KpiDefinition[] };
    const def = templateToDefinition(tpl);
    const auditSpecific = resolveKpisForTemplate(def);
    const concepts = new Set(
      def.fields.flatMap((f) => [f.standardConcept, f.key].filter(Boolean) as string[]),
    );
    const universal = KPI_CATALOG.filter(
      (k) =>
        k.layer === "universal" &&
        (!k.requiredConcepts?.length ||
          k.requiredConcepts.some((c) => concepts.has(String(c)))),
    );
    const operatingModel = KPI_CATALOG.filter(
      (k) =>
        k.layer === "operating_model" &&
        (!tpl.operating_model || k.operatingModels?.includes(tpl.operating_model)) &&
        (!k.requiredConcepts?.length ||
          k.requiredConcepts.some((c) => concepts.has(String(c)))),
    );
    return {
      universal,
      operatingModel,
      auditSpecific,
      templateName: tpl.name,
      operatingModelKey: tpl.operating_model,
    };
  }, [templateQuery.data]);

  if (templateQuery.isLoading) {
    return (
      <AppShell title="Template Intelligence">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (templateQuery.error || !templateQuery.data) {
    return (
      <AppShell title="Template Intelligence">
        <ErrorState title="Template not found" description="Could not load this template." />
      </AppShell>
    );
  }

  const tpl = templateQuery.data;

  return (
    <AppShell
      title={`${tpl.name} — Intelligence`}
      description="Audit-specific KPIs, trends, findings, and corrective actions derived from this template's fields and rules."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/audit-templates/$templateId" params={{ templateId }}>
            <ArrowLeft className="mr-1 size-4" />
            Back to builder
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/findings" search={{ template: templateId }}>
            <ExternalLink className="mr-1 size-4" />
            View all findings
          </Link>
        </Button>
      </div>

      <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <strong>Pre–Phase 2 illustrative data.</strong> KPI definitions and formulas are live from the
        centralized catalog; values wire to assignments and responses in Phase 2 live KPI wiring.
      </div>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="size-5" />
          Audit-Specific KPIs
        </h2>
        {!catalog.auditSpecific.length ? (
          <p className="text-sm text-muted-foreground">
            No audit-specific KPIs derived yet — add standard field concepts (expiry, facings, QC, etc.)
            in the template builder.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.auditSpecific.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                templateName={tpl.name}
                onViewAll={() => setExpandedKpi(kpi.id)}
              />
            ))}
          </div>
        )}
      </section>

      {catalog.operatingModel.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Operating model KPIs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.operatingModel.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                templateName={tpl.name}
                onViewAll={() => setExpandedKpi(kpi.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {catalog.universal.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Universal KPIs (supported by this template)</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.universal.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                templateName={tpl.name}
                onViewAll={() => setExpandedKpi(kpi.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recurring issues</CardTitle>
            <CardDescription>Patterns from historical audits using this template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between rounded-lg border p-3">
              <span>Near-expiry units not actioned</span>
              <Badge variant="secondary">3 locations</Badge>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <span>Evidence gap on shelf photos</span>
              <Badge variant="secondary">2 auditors</Badge>
            </div>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link to="/exceptions">View all recurring issues</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SLA & corrective actions</CardTitle>
            <CardDescription>Open workload for this template type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Open corrective actions</span>
              <strong>12</strong>
            </div>
            <div className="flex justify-between">
              <span>SLA breaches (30d)</span>
              <strong className="text-destructive">4</strong>
            </div>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link to="/corrective-actions">View all corrective actions</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {expandedKpi ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[80vh] w-full max-w-lg overflow-y-auto">
            <CardHeader>
              <CardTitle>View All — {expandedKpi}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed drill-down table for {expandedKpi}. Live data in Phase 2.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setExpandedKpi(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}

function KpiCard({
  kpi,
  templateName,
  onViewAll,
}: {
  kpi: KpiDefinition;
  templateName: string;
  onViewAll?: () => void;
}) {
  const towerKpi = toControlTowerKpi(kpi);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{kpi.name}</CardTitle>
          <KpiInfoPopover
            kpi={towerKpi}
            scopeLabel={templateName}
            periodLabel="Last 30 days (illustrative)"
          />
        </div>
        <CardDescription className="text-xs">{kpi.layer.replace("_", " ")} KPI</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{demoValue(kpi)}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5 text-success" />
          Trend (7d illustrative)
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onViewAll}>
            View All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() =>
              exportKpiCsv(
                kpi,
                [{ [kpi.csvColumns[0] ?? "Value"]: demoValue(kpi) }],
                { dateRange: "30d" },
                templateName,
              )
            }
          >
            <Download className="mr-1 size-3" />
            CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
