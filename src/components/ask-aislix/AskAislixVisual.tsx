import {
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

import type { AskAislixResponse } from "@/lib/ask-aislix/ask-aislix.types";
import { AISLIX } from "@/lib/aislix-theme";
import { CHART_SERIES } from "@/lib/ai-audit/kpi-palette";
import { AskAislixImageGallery } from "./AskAislixImageGallery";

const COLORS = CHART_SERIES;

const LABEL_KEYS = ["label", "name", "store", "date", "category", "product", "sku", "brand", "x"];
const VALUE_KEYS = ["value", "count", "total", "y"];

type ChartPoint = { name: string; value: number; unit?: string };

/** Model-written chart rows use varying keys; keep only rows with a real number to plot. */
function toChartPoints(rows: unknown[] | undefined): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const raw of rows ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const labelKey =
      LABEL_KEYS.find((k) => typeof row[k] === "string" && row[k]) ??
      Object.keys(row).find((k) => typeof row[k] === "string" && k !== "unit");
    const valueKey =
      VALUE_KEYS.find((k) => Number.isFinite(Number(row[k])) && row[k] !== null && row[k] !== "") ??
      Object.keys(row).find((k) => typeof row[k] === "number" && Number.isFinite(row[k]));
    if (!labelKey || !valueKey) continue;
    points.push({
      name: String(row[labelKey]),
      value: Number(row[valueKey]),
      unit: typeof row.unit === "string" ? row.unit : undefined,
    });
  }
  return points.some((p) => p.value !== 0) ? points : [];
}

export function AskAislixVisual({ visual }: { visual: AskAislixResponse["visual"] }) {
  if (!visual || visual.type === "none") return null;

  if (visual.type === "image_gallery") {
    return (
      <AskAislixImageGallery
        title={visual.title}
        items={(visual.data ?? []) as Array<Record<string, string>>}
      />
    );
  }

  if (visual.type === "kpi" && visual.data?.[0]) {
    const row = visual.data[0] as { label?: string; value?: string };
    return (
      <div className="rounded-xl border border-line bg-white p-5">
        <p className="text-sm text-mp-muted">{row.label ?? visual.title}</p>
        <p className="mt-2 font-display text-3xl font-semibold text-navy">{row.value ?? "—"}</p>
      </div>
    );
  }

  if (visual.type === "ranking") {
    const data = toChartPoints(visual.data);
    if (!data.length) return null;
    return (
      <div className="w-full" style={{ height: Math.max(120, data.length * 36 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#D9E2E8" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill={AISLIX.primary} radius={[0, 4, 4, 0]} animationDuration={300} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visual.type === "bar") {
    const data = toChartPoints(visual.data);
    if (!data.length) return null;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill={AISLIX.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visual.type === "line" || visual.type === "area") {
    const data = toChartPoints(visual.data);
    if (!data.length) return null;
    const unit = data.find((d) => d.unit)?.unit;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D9E2E8" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [unit ? `${v} ${unit}` : v, "Value"]} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#9B86D9"
              strokeWidth={2}
              dot={data.length <= 12 ? { r: 4, fill: "#9B86D9", strokeWidth: 0 } : false}
              label={data.length <= 8 ? { position: "top", fontSize: 11, fill: "#04203F" } : false}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visual.type === "donut") {
    const data = toChartPoints(visual.data);
    if (!data.length) return null;
    return (
      <div className="mx-auto h-64 w-full max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={50} outerRadius={80}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visual.type === "table") {
    const rows = visual.data ?? [];
    if (!rows.length) return null;
    const keys = Object.keys(rows[0] as object);
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-mp-muted">
            <tr>
              {keys.map((k) => (
                <th key={k} className="px-3 py-2 font-medium first-letter:uppercase">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2">
                    {String((row as Record<string, unknown>)[k] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
