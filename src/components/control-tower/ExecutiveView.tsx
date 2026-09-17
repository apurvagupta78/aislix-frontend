import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildControlTowerDemo, type ControlTowerSearch } from "@/lib/control-tower";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { OPERATING_MODEL_PALETTE } from "@/lib/design-system/semantic-colors";
import { cn } from "@/lib/utils";

const SUMMARY_SURFACES = [
  "border-[var(--aislix-primary)] bg-[var(--aislix-primary)] text-white",
  "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
  "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
  "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
  "border-[var(--aislix-border)] bg-white",
  "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
];

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
    id: c.id,
    model: c.title,
    health: c.id === "fmcg_distributor" ? 74 : c.id === "warehouse" ? 78 : 81,
    coverage: c.id === "fmcg_distributor" ? 68 : 82,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] p-3 text-xs text-[var(--aislix-primary)]">
        Executive summary — aggregated demo metrics. Avoids operational detail; Phase 2 wires live org
        aggregates.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((s, i) => (
          <Card key={s.label} className={cn("rounded-xl shadow-soft", SUMMARY_SURFACES[i])}>
            <CardContent className="p-4">
              <p className={cn("text-xs", i === 0 ? "text-white/70" : "text-muted-foreground")}>{s.label}</p>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" /> Operating model comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {modelComparison.map((row) => (
            <div
              key={row.model}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-sm",
                OPERATING_MODEL_PALETTE[row.id],
              )}
            >
              <span className="font-medium">{row.model}</span>
              <span className="text-[var(--aislix-secondary)]">
                Health {row.health} · Coverage {row.coverage}%
              </span>
              <TrendingUp className="size-4 text-[var(--aislix-primary)]" />
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
