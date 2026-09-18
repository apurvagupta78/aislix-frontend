import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Flame, Gauge, Radar as RadarIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoDataBadge } from "@/components/control-tower/DemoDataBadge";
import type { ControlTowerDemoPayload } from "@/lib/control-tower";
import { AISLIX, AISLIX_CHART } from "@/lib/aislix-theme";

/**
 * Visual board — presentation only. Reads the same demo payload the rest of the
 * Control Tower uses; no data, API, or calculation changes.
 */
export function DashboardVisualBoard({ data }: { data: ControlTowerDemoPayload }) {
  const gauges = useMemo(
    () => [
      { name: "SLA on time", value: data.sla.compliancePct, fill: AISLIX_CHART[0] },
      { name: "Evidence verified", value: data.evidenceCoverage.pct, fill: AISLIX_CHART[1] },
      {
        name: "Actions closed",
        value: Math.round(
          (data.correctiveActionHealth.closed /
            Math.max(
              1,
              data.correctiveActionHealth.closed +
                data.correctiveActionHealth.open +
                data.correctiveActionHealth.overdue,
            )) *
            100,
        ),
        fill: AISLIX_CHART[2],
      },
    ],
    [data],
  );

  const radar = useMemo(() => {
    const total = Math.max(
      1,
      data.correctiveActionHealth.open +
        data.correctiveActionHealth.overdue +
        data.correctiveActionHealth.closed,
    );
    return [
      { axis: "Compliance", score: data.sla.compliancePct },
      { axis: "Evidence", score: data.evidenceCoverage.pct },
      { axis: "Speed", score: Math.max(10, 100 - data.sla.avgResolutionHours * 2) },
      { axis: "Follow-up", score: Math.round((data.correctiveActionHealth.closed / total) * 100) },
      {
        axis: "Stability",
        score: Math.max(10, 100 - data.recurringIssues.length * 6),
      },
    ];
  }, [data]);

  const heat = useMemo(() => data.riskLocationsFull.slice(0, 8), [data.riskLocationsFull]);

  const combo = useMemo(
    () =>
      data.auditTrend.map((point) => ({
        ...point,
        gap: Math.max(0, point.findings - Math.round(point.completed / 4)),
      })),
    [data.auditTrend],
  );

  return (
    <div className="space-y-4">
      {data.labeledDemo ? <DemoDataBadge showCta /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame
        icon={<Gauge className="size-4" />}
        title="How healthy are we right now?"
        description="Three headline rates in one dial."
      >
        <ResponsiveContainer width="100%" height={260}>
          <RadialBarChart data={gauges} innerRadius="32%" outerRadius="100%" startAngle={200} endAngle={-20}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={12} background />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
          </RadialBarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        icon={<RadarIcon className="size-4" />}
        title="Where are we strong or weak?"
        description="Five operating dimensions, 0-100."
      >
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radar} outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="score"
              stroke={AISLIX.primary}
              fill={AISLIX.primary}
              fillOpacity={0.35}
            />
            <Tooltip formatter={(v: number) => `${v}`} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        icon={<Flame className="size-4" />}
        title="Which places need a visit first?"
        description="Darker means higher risk."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {heat.map((row) => {
            const intensity = Math.min(1, Math.max(0.18, row.score / 100));
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--aislix-darkstore-border)] px-3 py-2.5 text-sm text-foreground"
                style={{
                  backgroundColor: `color-mix(in srgb, ${AISLIX.darkstoreBg} ${Math.round(intensity * 100)}%, #FFFFFF)`,
                }}
              >
                <span className="truncate font-medium">{row.name}</span>
                <span className="shrink-0 rounded-full border border-[var(--aislix-darkstore-border)] bg-white/70 px-2 py-0.5 text-xs font-semibold">
                  {row.score}
                </span>
              </div>
            );
          })}
        </div>
      </ChartFrame>

      <ChartFrame
        icon={<Activity className="size-4" />}
        title="Are audits keeping up with problems?"
        description="Bars: audits done. Line: problems found."
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={combo}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="completed" name="Audits done" fill={AISLIX.primary} radius={[8, 8, 0, 0]} barSize={18} />
            <Line
              dataKey="findings"
              name="Problems found"
              stroke={AISLIX.darkstoreBg}
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function ChartFrame({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]">
            {icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}
