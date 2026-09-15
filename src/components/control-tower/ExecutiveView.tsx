import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildControlTowerDemo, type ControlTowerSearch } from "@/lib/control-tower";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";

export function ExecutiveView({ search }: { search: ControlTowerSearch }) {
  const model = search.model ?? "all";
  const data = useMemo(() => buildControlTowerDemo(model), [model]);

  const summary = [
    { label: "Total locations", value: "48" },
    { label: "Audit coverage", value: "82%" },
    { label: "Critical risk", value: data.criticalFindings.length.toString() },
    { label: "Potential value variance", value: "₹2.14L" },
    { label: "Open findings", value: data.universalKpis.find((k) => k.id === "open_findings")?.value ?? "—" },
    { label: "SLA compliance", value: `${data.sla.compliancePct}%` },
  ];

  const modelComparison = OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => ({
    model: c.title,
    health: c.id === "fmcg_distributor" ? 74 : c.id === "warehouse" ? 78 : 81,
    coverage: c.id === "fmcg_distributor" ? 68 : 82,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Executive summary — aggregated demo metrics. Avoids operational detail; Phase 2 wires live org
        aggregates.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" /> Operating model comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {modelComparison.map((row) => (
            <div
              key={row.model}
              className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
            >
              <span className="font-medium">{row.model}</span>
              <span className="text-muted-foreground">
                Health {row.health} · Coverage {row.coverage}%
              </span>
              <TrendingUp className="size-4 text-brand" />
            </div>
          ))}
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/dashboard">Open Control Tower</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
