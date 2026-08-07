import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { Panel } from "@/components/dashboard/DashboardParts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsResponse, SeriesPoint } from "@/lib/dashboard";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartFrame({
  title,
  action,
  data,
  isLoading,
  error,
  onRetry,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  data?: SeriesPoint[] | undefined;
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: (rows: SeriesPoint[]) => React.ReactNode;
  className?: string;
}) {
  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton className="h-56 w-full" />;
  } else if (error) {
    body = (
      <ErrorState
        title="Chart unavailable"
        description={error.message}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  } else if (!data || data.length === 0) {
    body = (
      <EmptyState
        title="No data for this period"
        description="This widget fills in as scans are processed."
        icon={<BarChart3 className="size-5" />}
      />
    );
  } else {
    body = (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children(data) as React.ReactElement}
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <Panel title={title} {...(action ? { action } : {})} className={className}>
      {body}
    </Panel>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  stroke: "var(--muted-foreground)",
} as const;

export function DashboardCharts({
  analytics,
  isLoading,
  error,
  onRetry,
}: {
  analytics?: AnalyticsResponse | undefined;
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("daily");

  const scanSeries =
    cadence === "daily"
      ? analytics?.daily_scans
      : cadence === "weekly"
        ? analytics?.weekly_scans
        : analytics?.monthly_scans;

  const state = { isLoading, error, ...(onRetry ? { onRetry } : {}) };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame
        title="Shelf health trend"
        data={analytics?.shelf_health_trend}
        className="lg:col-span-2"
        {...state}
      >
        {(rows) => (
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="dashHealth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="value"
              name="Shelf health"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              fill="url(#dashHealth)"
            />
          </AreaChart>
        )}
      </ChartFrame>

      <ChartFrame
        title="Scan volume"
        data={scanSeries}
        action={
          <Tabs value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
            <TabsList className="h-8 rounded-lg">
              <TabsTrigger value="daily" className="rounded-md text-xs">
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="rounded-md text-xs">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-md text-xs">
                Monthly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
        {...state}
      >
        {(rows) => (
          <BarChart data={rows} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Scans" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
          </BarChart>
        )}
      </ChartFrame>

      <ChartFrame title="Brand distribution" data={analytics?.brand_distribution} {...state}>
        {(rows) => (
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={2}
            >
              {rows.map((row, i) => (
                <Cell key={row.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ChartFrame>

      <ChartFrame
        title="Low stock trend"
        data={analytics?.low_stock_trend}
        className="lg:col-span-2"
        {...state}
      >
        {(rows) => (
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              name="Low stock SKUs"
              stroke="var(--accent-green)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        )}
      </ChartFrame>
    </div>
  );
}
