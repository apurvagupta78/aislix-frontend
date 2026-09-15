import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Clock, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ControlTowerSearch } from "@/lib/control-tower";
import { buildControlTowerDemo } from "@/lib/control-tower";

export function MyPerformanceView({ search }: { search: ControlTowerSearch }) {
  const model = search.model ?? "all";
  const data = useMemo(() => buildControlTowerDemo(model), [model]);

  const metrics = [
    { label: "Assigned audits", value: "12", icon: ClipboardCheck },
    { label: "Completed", value: "9", icon: Target },
    { label: "Completion %", value: "75%", icon: Target },
    { label: "On-time %", value: "89%", icon: Clock },
    { label: "Evidence completion %", value: `${data.evidenceCoverage.pct}%`, icon: ClipboardCheck },
    { label: "Findings created", value: "6", icon: Target },
    { label: "Pending audits", value: "3", icon: Clock },
    { label: "Overdue audits", value: "1", icon: Clock },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Role-scoped performance view — demo data for Phase 1E. Live assignment metrics in Phase 2.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <m.icon className="size-5 text-brand" />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-semibold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Your audit queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Weekly completion target</span>
            <Badge variant="secondary">9 / 12</Badge>
          </div>
          <Progress value={75} />
          <Button asChild variant="brand" size="sm">
            <Link to="/my-scans">Open assigned audits</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
