import { createFileRoute } from "@tanstack/react-router";
import { KpiCards } from "@/components/dashboard/DashboardParts";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import type { AnalyticsResponse, DashboardKpis } from "@/lib/dashboard";

export const Route = createFileRoute("/marketing-shot")({
  component: Shot,
});

const kpis: DashboardKpis = {
  total_scans: 1284,
  products_detected: 74210,
  stores: 18,
  shelf_health_score: 88,
  low_stock_alerts: 42,
  out_of_stock_alerts: 11,
  average_confidence: 0.946,
  scans_remaining: null,
};

const day = (i: number) => `Aug ${i}`;
const analytics: AnalyticsResponse = {
  shelf_health_trend: [72, 75, 74, 79, 81, 80, 84, 86, 85, 88, 90, 88].map((v, i) => ({
    label: day(i + 1),
    value: v,
  })),
  daily_scans: [18, 24, 21, 32, 28, 39, 35, 44, 41, 52, 48, 57].map((v, i) => ({
    label: day(i + 1),
    value: v,
  })),
  brand_distribution: [
    { label: "Nestlé", value: 312 },
    { label: "Britannia", value: 268 },
    { label: "Parle", value: 194 },
    { label: "ITC", value: 156 },
    { label: "Others", value: 121 },
  ],
  low_stock_trend: [22, 19, 25, 18, 16, 21, 14, 12, 15, 11, 9, 10].map((v, i) => ({
    label: day(i + 1),
    value: v,
  })),
};

function Shot() {
  return (
    <div className="bg-surface p-8">
      <KpiCards kpis={kpis} isLoading={false} />
      <div className="mt-6">
        <DashboardCharts analytics={analytics} isLoading={false} />
      </div>
    </div>
  );
}
