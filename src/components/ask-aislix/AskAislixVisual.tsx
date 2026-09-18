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
import { AskAislixImageGallery } from "./AskAislixImageGallery";

const COLORS = [AISLIX.primary, AISLIX.darkstoreBg, "#FFE8A3", "#C8E6C9", "#F5C6CB"];

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
      <div className="rounded-xl border border-line bg-white p-5 shadow-card">
        <p className="text-xs uppercase tracking-wide text-mp-muted">{row.label ?? visual.title}</p>
        <p className="mt-2 font-display text-3xl font-semibold text-navy">{row.value ?? "—"}</p>
      </div>
    );
  }

  if (visual.type === "bar" || visual.type === "ranking") {
    const data = (visual.data ?? []) as Array<{ label?: string; name?: string; value?: number }>;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map((d) => ({ name: d.label ?? d.name, value: d.value ?? 0 }))}>
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
    const data = visual.data ?? [];
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data as object[]}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={AISLIX.primary} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visual.type === "donut") {
    const data = (visual.data ?? []) as Array<{ name?: string; label?: string; value?: number }>;
    return (
      <div className="mx-auto h-64 w-full max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.map((d) => ({ name: d.name ?? d.label, value: d.value ?? 0 }))} dataKey="value" innerRadius={50} outerRadius={80}>
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
          <thead className="bg-muted/40 text-left text-xs uppercase text-mp-muted">
            <tr>
              {keys.map((k) => (
                <th key={k} className="px-3 py-2">
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
