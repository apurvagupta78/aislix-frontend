import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanLine,
  Package,
  Tags,
  Gauge,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  inventoryTrend,
  lowStockAlerts,
  scans,
  shelfHealthTrend,
  stats,
  topBrands,
} from "@/lib/aislix-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aislix Shelf Intelligence" },
      {
        name: "description",
        content:
          "Shelf health, product detections, brand coverage and low-stock alerts across all your stores in one dashboard.",
      },
      { property: "og:title", content: "Aislix Dashboard" },
      { property: "og:description", content: "Live retail shelf intelligence across your stores." },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Total Scans", value: stats.totalScans.toLocaleString(), delta: "+12.4%", icon: ScanLine },
  { label: "Products Detected", value: stats.productsDetected.toLocaleString(), delta: "+8.1%", icon: Package },
  { label: "Brands Detected", value: stats.brandsDetected.toString(), delta: "+3.6%", icon: Tags },
  { label: "Avg. AI Confidence", value: `${stats.avgConfidence}%`, delta: "+0.9%", icon: Gauge },
];

function Card({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-surface p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dashboard() {
  return (
    <AppShell
      title="Good afternoon, Rahul"
      description="Here's how your shelves are performing across 42 stores today."
      actions={
        <>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/history">Scan history</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/upload">Upload scan</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-surface card-hover p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                <k.icon className="size-4" />
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-green">
                <ArrowUpRight className="size-3" />
                {k.delta}
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Inventory Trend"
          className="lg:col-span-2"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5 text-brand" /> Last 7 months
            </span>
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inventoryTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="products"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  fill="url(#g1)"
                  name="Products detected"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Shelf Health Score">
          <div className="flex flex-col items-center">
            <div
              className="grid size-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--brand-glow) ${stats.shelfHealth}%, var(--border) 0)`,
              }}
            >
              <div className="grid size-32 place-items-center rounded-full bg-card">
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight">{stats.shelfHealth}</p>
                  <p className="text-xs text-muted-foreground">out of 100</p>
                </div>
              </div>
            </div>
            <Badge className="mt-5 rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
              Healthy · +6 vs last week
            </Badge>
            <div className="mt-5 h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shelfHealthTrend}>
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <XAxis dataKey="week" hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Recent Scans"
          className="lg:col-span-2"
          action={
            <Link to="/history" className="text-xs font-medium text-brand hover:underline">
              View all
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {scans.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to="/results"
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-xs font-medium text-brand">
                  {s.store.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.store}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.aisle} · {s.date} {s.time}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{s.products}</p>
                  <p className="text-xs text-muted-foreground">products</p>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12"
                >
                  {s.confidence ? `${s.confidence}%` : "—"}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card
          title="Low Stock Alerts"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3" /> {stats.lowStockAlerts} open
            </span>
          }
        >
          <ul className="space-y-3">
            {lowStockAlerts.map((a) => (
              <li key={a.sku} className="flex items-center gap-3">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    a.severity === "critical"
                      ? "bg-destructive"
                      : a.severity === "warning"
                        ? "bg-warning"
                        : "bg-brand"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.sku}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.store}</p>
                </div>
                <span className="text-xs text-muted-foreground">{a.facings} facings</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Top Brands by Share of Shelf">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBrands} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="brand"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={80}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="share" fill="var(--chart-2)" radius={[0, 8, 8, 0]} name="Share %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Empty Facings Trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inventoryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="empty"
                  stroke="var(--accent-green)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Empty facings"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
